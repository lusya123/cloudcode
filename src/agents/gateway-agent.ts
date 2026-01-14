import fs from 'fs/promises';
import path from 'path';
import type { FeishuMessage } from '../types/feishu';
import type { SessionMetadata } from '../types/session';
import type { ScheduledTask } from '../types/task';
import type { EventBus } from '../utils/event-bus';
import { SessionManager } from '../managers/session-manager';
import { TaskScheduler } from '../scheduler/task-scheduler';
import { loadProviderConfig, saveProviderConfig } from '../utils/config-loader';
import type { ProviderConfig } from '../types/provider';
import { Logger } from '../utils/logger';

interface Intent {
  type:
    | 'new_session'
    | 'switch_session'
    | 'list_sessions'
    | 'file_read'
    | 'task_execution'
    | 'schedule_task'
    | 'configure'
    | 'continue';
  payload?: Record<string, any>;
}

interface PendingAction {
  type: 'new_session' | 'schedule_task' | 'switch_session';
  payload: Record<string, any>;
}

export class GatewayAgent {
  private sessionManager: SessionManager;
  private scheduler: TaskScheduler;
  private pending: Map<string, PendingAction> = new Map();
  private eventBus?: EventBus;
  private logger: Logger;

  constructor(sessionManager: SessionManager, scheduler: TaskScheduler, eventBus?: EventBus) {
    this.sessionManager = sessionManager;
    this.scheduler = scheduler;
    this.eventBus = eventBus;
    this.logger = new Logger('GatewayAgent');
  }

  async handleMessage(message: FeishuMessage | { message: string; chatId?: string }): Promise<string> {
    const chatId = 'chatId' in message && message.chatId ? message.chatId : 'local';

    const pendingAction = this.pending.get(chatId);
    if (pendingAction) {
      this.pending.delete(chatId);
      return this.handlePending(pendingAction, message.message);
    }

    const intent = this.analyzeIntent(message.message);
    this.logger.info(`Intent detected: ${intent.type}`);

    this.eventBus?.broadcast('intent', { intent: intent.type, message: message.message });

    switch (intent.type) {
      case 'new_session':
        return this.handleNewSession(intent.payload || {}, chatId);
      case 'switch_session':
        return this.handleSwitchSession(intent.payload || {}, chatId);
      case 'list_sessions':
        return this.handleListSessions();
      case 'file_read':
        return this.handleFileRead(message.message, intent.payload || {});
      case 'task_execution':
        return this.handleTaskExecution(message.message, chatId);
      case 'schedule_task':
        return this.handleScheduleTask(intent.payload || {}, message.message, chatId);
      case 'configure':
        return this.handleConfigure(message.message);
      case 'continue':
      default:
        return this.handleContinue(message.message, chatId);
    }
  }

  private async handlePending(action: PendingAction, response: string): Promise<string> {
    if (action.type === 'new_session') {
      const workingDir = response.trim();
      const name = action.payload.name || 'New Session';
      const session = await this.sessionManager.createSession(name, workingDir, 'project');
      await this.sessionManager.setActiveSession(session.id);
      this.eventBus?.broadcast('session_created', session);
      return `Created session [${session.name}] at ${session.workingDir}. What would you like to do next?`;
    }

    if (action.type === 'switch_session') {
      const target = response.trim();
      const sessions = await this.sessionManager.listSessions();
      const session = this.findSessionByNameOrId(sessions, target);
      if (!session) {
        return `Session not found. Please provide a valid session name or id.`;
      }
      await this.sessionManager.setActiveSession(session.id);
      this.eventBus?.broadcast('session_switched', session);
      return `Switched to session [${session.name}] at ${session.workingDir}.`;
    }

    if (action.type === 'schedule_task') {
      let workingDir = this.extractWorkingDir(response) || action.payload.workingDir;
      if (!workingDir) {
        workingDir = await this.getDefaultWorkingDir();
      }
      const cron = this.extractCron(response) || action.payload.cron;
      if (!cron) {
        return 'Please provide a schedule time (cron or a time like "every day at 12").';
      }

      const instruction = this.resolveScheduledInstruction(response, action.payload);
      if (!instruction) {
        return 'Please describe what the scheduled task should do (e.g., "collect data").';
      }

      const name = action.payload.name || this.formatTaskName(instruction);
      const task = this.buildTask({
        name,
        instruction,
        cron,
        workingDir
      });
      await this.scheduler.addTask(task);
      this.eventBus?.broadcast('task_scheduled', task);
      return `Scheduled task [${task.name}] (${task.cron}) in ${task.workingDir}.`;
    }

    return 'Pending request cleared.';
  }

  private analyzeIntent(message: string): Intent {
    const lower = message.toLowerCase();

    if (/new session|create session|new project|new chat|new conversation|start new chat|开启新的对话|开启新对话|开始新对话|新建对话|新建会话|创建会话|创建新会话|新会话|新对话/.test(lower)) {
      return { type: 'new_session', payload: { name: this.extractSessionName(message) } };
    }

    if (/switch|切换会话|切换对话|切换到|切换至/.test(lower)) {
      return { type: 'switch_session', payload: { target: this.extractSessionName(message) } };
    }

    if (/list sessions|sessions list|session list|会话列表|对话列表|历史会话|历史对话/.test(lower)) {
      return { type: 'list_sessions' };
    }

    if (/cron|schedule|every day|every hour|every\s+\d+\s+minutes?|定时任务|定时|每天|每小时|每\s*\d+\s*分钟/.test(lower)) {
      return {
        type: 'schedule_task',
        payload: {
          cron: this.extractCron(message),
          workingDir: this.extractWorkingDir(message)
        }
      };
    }

    if (this.isFileReadIntent(message)) {
      return { type: 'file_read', payload: { path: this.extractPathCandidate(message) } };
    }

    if (/help me|please do|run /.test(lower)) {
      return { type: 'task_execution' };
    }

    const configUpdates = this.parseProviderUpdates(message);
    if (configUpdates.hasUpdates || configUpdates.showOnly) {
      return { type: 'configure' };
    }

    return { type: 'continue' };
  }

  private async handleNewSession(payload: Record<string, any>, chatId: string): Promise<string> {
    let workingDir = this.extractWorkingDir(payload.name || '') || payload.workingDir;
    const name = payload.name || 'New Session';

    if (!workingDir) {
      const activeSessionId = this.sessionManager.getActiveSessionId();
      if (activeSessionId) {
        const activeSession = await this.sessionManager.getSession(activeSessionId);
        workingDir = activeSession?.workingDir;
      }
    }

    if (!workingDir) {
      workingDir = process.cwd();
    }

    if (!workingDir) {
      this.pending.set(chatId, { type: 'new_session', payload: { name } });
      return 'What working directory should this session use?';
    }

    const session = await this.sessionManager.createSession(name, workingDir, 'project');
    await this.sessionManager.setActiveSession(session.id);
    this.eventBus?.broadcast('session_created', session);
    return `Created session [${session.name}] at ${session.workingDir}. What would you like to do next?`;
  }

  private async handleSwitchSession(payload: Record<string, any>, chatId: string): Promise<string> {
    const target = payload.target || this.extractSessionName(payload.message || '');
    if (!target) {
      this.pending.set(chatId, { type: 'switch_session', payload: {} });
      return 'Which session should I switch to?';
    }

    const sessions = await this.sessionManager.listSessions();
    const session = this.findSessionByNameOrId(sessions, target);
    if (!session) {
      return `Session not found: ${target}`;
    }

    await this.sessionManager.setActiveSession(session.id);
    this.eventBus?.broadcast('session_switched', session);
    return `Switched to session [${session.name}] at ${session.workingDir}.`;
  }

  private async handleListSessions(): Promise<string> {
    const sessions = await this.sessionManager.listSessions();
    if (sessions.length === 0) {
      return 'No sessions found.';
    }

    const lines = sessions.map(session => `- ${session.name} (${session.id}) in ${session.workingDir}`);
    return `Sessions:\n${lines.join('\n')}`;
  }

  private async handleFileRead(message: string, payload: Record<string, any>): Promise<string> {
    const rawPath = (payload.path as string | undefined) || this.extractPathCandidate(message);
    if (!rawPath) {
      return 'Please provide a file or directory path to read.';
    }

    const baseDir = await this.getDefaultWorkingDir();
    const targetPath = this.resolveUserPath(rawPath, baseDir);

    try {
      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        return this.renderDirectoryListing(targetPath);
      }
      return this.renderFileContent(targetPath);
    } catch (error: any) {
      return `Unable to read path: ${targetPath}\n${error.message}`;
    }
  }

  private async handleTaskExecution(message: string, chatId: string): Promise<string> {
    const workingDir = this.extractWorkingDir(message) || (await this.getDefaultWorkingDir());
    const result = await this.sessionManager.executeEphemeralTask(message, workingDir);
    this.eventBus?.broadcast('task_completed', { chatId, result });
    return result;
  }

  private async handleScheduleTask(payload: Record<string, any>, message: string, chatId: string): Promise<string> {
    const cron = payload.cron || this.extractCron(message);
    let workingDir = payload.workingDir || this.extractWorkingDir(message);
    if (!workingDir) {
      workingDir = await this.getDefaultWorkingDir();
    }

    if (!cron) {
      this.pending.set(chatId, {
        type: 'schedule_task',
        payload: {
          name: payload.name,
          instruction: payload.instruction,
          cron,
          workingDir,
          originalMessage: message
        }
      });
      return 'Please provide the schedule time (cron or a time like "every day at 12").';
    }

    const instruction = this.resolveScheduledInstruction(message, payload);
    if (!instruction) {
      this.pending.set(chatId, {
        type: 'schedule_task',
        payload: {
          name: payload.name,
          instruction: payload.instruction,
          cron,
          workingDir,
          originalMessage: message
        }
      });
      return 'Please describe what the scheduled task should do (e.g., "collect data").';
    }

    const name = payload.name || this.formatTaskName(instruction);
    const task = this.buildTask({
      name,
      instruction,
      cron,
      workingDir
    });

    await this.scheduler.addTask(task);
    this.eventBus?.broadcast('task_scheduled', task);
    return `Scheduled task [${task.name}] (${task.cron}) in ${task.workingDir}.`;
  }

  private async handleContinue(message: string, chatId: string): Promise<string> {
    let sessionId = this.sessionManager.getActiveSessionId();
    if (!sessionId) {
      const session = await this.sessionManager.createSession('Default Session', process.cwd(), 'interactive');
      sessionId = session.id;
      await this.sessionManager.setActiveSession(sessionId);
    }

    const result = await this.sessionManager.executeInSession(sessionId, message);
    this.eventBus?.broadcast('message', { chatId, result });
    return result;
  }

  private handleConfigure(message: string): string {
    const updates = this.parseProviderUpdates(message);
    const current = loadProviderConfig();

    if (updates.showOnly && !updates.hasUpdates) {
      return this.formatProviderConfig(current);
    }

    if (!updates.hasUpdates) {
      return 'No provider changes detected. Try: set api key <key>, set base url <url>, set model <name>, or show config.';
    }

    const nextConfig: ProviderConfig = {
      provider: 'anthropic',
      apiKey: updates.apiKey ?? current.apiKey,
      baseUrl: updates.baseUrl ?? current.baseUrl,
      model: updates.model ?? current.model
    };

    saveProviderConfig(nextConfig);
    this.sessionManager.updateProviderConfig(nextConfig);

    return `Provider config updated. ${this.formatProviderConfig(nextConfig)}`;
  }

  private parseProviderUpdates(message: string): {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    showOnly: boolean;
    hasUpdates: boolean;
  } {
    const lower = message.toLowerCase();
    const showOnly =
      /show|display|current|查看|显示|当前/.test(lower) &&
      /config|provider|api key|base url|model|配置|模型|密钥|key|url/.test(lower);

    const apiKeyMatch = message.match(/api\\s*key\\s*[:=]\\s*([^\\s]+)/i) || message.match(/api\\s*key\\s+([^\\s]+)/i);
    const baseUrlMatch = message.match(/base\\s*url\\s*[:=]\\s*([^\\s]+)/i) || message.match(/base\\s*url\\s+([^\\s]+)/i);
    const modelMatch = message.match(/model\\s*[:=]\\s*([^\\s]+)/i) || message.match(/model\\s+([^\\s]+)/i);

    const clearBaseUrl = /clear\\s+base\\s+url|reset\\s+base\\s+url/.test(lower);

    const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : undefined;
    const baseUrl = clearBaseUrl ? '' : baseUrlMatch ? baseUrlMatch[1].trim() : undefined;
    const model = modelMatch ? modelMatch[1].trim() : undefined;

    const hasUpdates = Boolean(apiKey || baseUrl !== undefined || model);

    return { apiKey, baseUrl, model, showOnly, hasUpdates };
  }

  private formatProviderConfig(config: ProviderConfig): string {
    const maskedKey = config.apiKey
      ? `${config.apiKey.slice(0, 6)}...${config.apiKey.slice(-4)}`
      : '(empty)';
    return `provider=anthropic, apiKey=${maskedKey}, baseUrl=${config.baseUrl || '(default)'}, model=${config.model || '(default)'}`;
  }

  private resolveScheduledInstruction(message: string, payload: Record<string, any>): string | null {
    if (payload.instruction) {
      return String(payload.instruction);
    }
    const fromMessage = this.extractScheduleInstruction(message);
    if (fromMessage) {
      return fromMessage;
    }
    if (payload.originalMessage) {
      return this.extractScheduleInstruction(String(payload.originalMessage));
    }
    return null;
  }

  private extractScheduleInstruction(message: string): string | null {
    let source = message;
    const taskMatch = message.match(/(.+?)的定时任务/);
    if (taskMatch?.[1]) {
      source = taskMatch[1];
    } else {
      const colonMatch = message.match(/定时任务[:：]\s*(.+)$/);
      if (colonMatch?.[1]) {
        source = colonMatch[1];
      }
    }

    let cleaned = source;
    const patterns: RegExp[] = [
      /请你|请帮我|帮我|麻烦|可以|能不能/g,
      /(设置|设定|安排|创建|添加|建立|新增|制定)/g,
      /(一个|个|条|次)/g,
      /(定时任务|定时|任务|schedule|cron)/gi,
      /(每天|每日|每晚|每早|每小时|每周|每月)/g,
      /每\s*\d+\s*(分钟|小时)/g,
      /every\s+(day|hour|week|month)/gi,
      /every\s+\d+\s+minutes?/gi,
      /\b\d{1,2}[:：]\d{2}\b/g,
      /(上午|下午|晚上|中午|凌晨|am|pm)\s*\d{1,2}(?:[:：]\d{2})?\s*(点钟|点|时)?/gi,
      /\b\d{1,2}\s*(点钟|点|时)\b/g
    ];
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, ' ');
    }
    cleaned = cleaned.replace(/[，。！？,;：:]+/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/^(进行|执行|做|做一次|执行一次)\s*/g, '');
    cleaned = cleaned.replace(/\s*(吧|好吗|可以吗|行吗)$/g, '');
    cleaned = cleaned.replace(/的$/g, '').trim();

    return cleaned.length ? cleaned : null;
  }

  private formatTaskName(instruction: string): string {
    const normalized = instruction.replace(/\s+/g, ' ').trim();
    const maxLength = 48;
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength)}...`;
  }

  private async getDefaultWorkingDir(): Promise<string> {
    const activeSessionId = this.sessionManager.getActiveSessionId();
    if (activeSessionId) {
      const activeSession = await this.sessionManager.getSession(activeSessionId);
      if (activeSession?.workingDir) {
        return activeSession.workingDir;
      }
    }
    return process.cwd();
  }

  private isFileReadIntent(message: string): boolean {
    const lower = message.toLowerCase();
    const hasReadKeyword =
      /read|open|show|cat/.test(lower) || /查看|读取|读|打开|内容/.test(message);
    if (!hasReadKeyword) {
      return false;
    }
    return Boolean(this.extractPathCandidate(message));
  }

  private extractPathCandidate(message: string): string | null {
    const match = message.match(/(?:~\/|\/|\.\.?\/)[^\s]+/);
    if (!match) {
      return null;
    }
    return this.normalizePath(match[0]);
  }

  private normalizePath(value: string): string {
    return value.replace(/[\]),.;:]+$/g, '').replace(/['"]+$/g, '');
  }

  private resolveUserPath(rawPath: string, baseDir: string): string {
    if (rawPath.startsWith('~/')) {
      const home = process.env.HOME || '';
      return path.join(home, rawPath.slice(2));
    }
    if (path.isAbsolute(rawPath)) {
      return rawPath;
    }
    return path.join(baseDir, rawPath);
  }

  private async renderDirectoryListing(dirPath: string): Promise<string> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const maxEntries = 200;
    const lines = entries.slice(0, maxEntries).map(entry => (entry.isDirectory() ? `${entry.name}/` : entry.name));
    const suffix = entries.length > maxEntries
      ? `\n\n(Only first ${maxEntries} entries shown of ${entries.length}.)`
      : '';
    return `Directory: ${dirPath}\n${lines.join('\n')}${suffix}`;
  }

  private async renderFileContent(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const maxLines = 2000;
    const selectedLines = lines.slice(0, maxLines);
    const numberedContent = selectedLines
      .map((line, i) => `${String(i + 1).padStart(6)}\t${line}`)
      .join('\n');
    const suffix = lines.length > maxLines
      ? `\n\n(Only first ${maxLines} lines shown of ${lines.length}.)`
      : '';
    return `File: ${filePath}\n${numberedContent}${suffix}`;
  }

  private extractWorkingDir(message: string): string | null {
    const match = message.match(/\/[\w\-./]+/);
    return match ? match[0] : null;
  }

  private extractCron(message: string): string | null {
    const dayMatch = message.match(/every day at (\d{1,2})/i);
    if (dayMatch) {
      const hour = Number(dayMatch[1]);
      return `0 ${hour} * * *`;
    }

    const dayCnMatch = message.match(/每天\s*(\d{1,2})(?:点|时)/);
    if (dayCnMatch) {
      const hour = Number(dayCnMatch[1]);
      return `0 ${hour} * * *`;
    }

    if (/every hour/.test(message)) {
      return '0 * * * *';
    }

    if (/每小时/.test(message)) {
      return '0 * * * *';
    }

    const minutesMatch = message.match(/every (\d+) minutes?/i);
    if (minutesMatch) {
      const minutes = Number(minutesMatch[1]);
      return `*/${minutes} * * * *`;
    }

    const minutesCnMatch = message.match(/每\s*(\d+)\s*分钟/);
    if (minutesCnMatch) {
      const minutes = Number(minutesCnMatch[1]);
      return `*/${minutes} * * * *`;
    }

    const cronMatch = message.match(/\b(\d+\s+\d+\s+\*\s+\*\s+\*)\b/);
    if (cronMatch) {
      return cronMatch[1];
    }

    const timeMatch = message.match(/(上午|下午|晚上|中午|am|pm)?\s*(\d{1,2})(?:[:：](\d{2}))?\s*(点|时)?/i);
    if (timeMatch) {
      const period = timeMatch[1]?.toLowerCase();
      const hourRaw = Number(timeMatch[2]);
      const minuteRaw = timeMatch[3] ? Number(timeMatch[3]) : 0;
      const hasTimeHint = Boolean(timeMatch[1] || timeMatch[3] || timeMatch[4] || /[:：]/.test(timeMatch[0]));

      if (
        hasTimeHint &&
        Number.isFinite(hourRaw) &&
        Number.isFinite(minuteRaw) &&
        hourRaw >= 0 &&
        hourRaw <= 23 &&
        minuteRaw >= 0 &&
        minuteRaw <= 59
      ) {
        let hour = hourRaw;
        if (period === 'pm' && hour < 12) {
          hour += 12;
        } else if (period === 'am' && hour === 12) {
          hour = 0;
        } else if ((period === '下午' || period === '晚上') && hour < 12) {
          hour += 12;
        } else if (period === '中午' && hour >= 1 && hour <= 10) {
          hour += 12;
        } else if (period === '上午' && hour === 12) {
          hour = 0;
        }

        return `${minuteRaw} ${hour} * * *`;
      }
    }

    return null;
  }

  private extractSessionName(message: string): string | null {
    const match =
      message.match(/session\s+([\w\-]+)/i) ||
      message.match(/(?:会话|对话)\s*[:：]?\s*([\w\-\u4e00-\u9fa5]+)/i) ||
      message.match(/(?:会话|对话)名称\s*[:：]?\s*([\w\-\u4e00-\u9fa5]+)/i);
    return match ? match[1] : null;
  }

  private findSessionByNameOrId(sessions: SessionMetadata[], target: string): SessionMetadata | null {
    const lower = target.toLowerCase();
    return sessions.find(session => session.id === target || session.name.toLowerCase() === lower) || null;
  }

  private buildTask(input: { name: string; instruction: string; cron: string; workingDir: string }): ScheduledTask {
    return {
      id: `task_${Date.now()}`,
      name: input.name,
      cron: input.cron,
      enabled: true,
      instruction: input.instruction,
      workingDir: input.workingDir,
      createdAt: new Date().toISOString()
    };
  }
}
