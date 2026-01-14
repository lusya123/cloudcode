import * as os from 'os';
import { randomUUID } from 'crypto';
import type { SessionManager } from '../managers/session-manager';
import type { TaskScheduler } from '../scheduler/task-scheduler';
import type { ScheduledTask } from '../types/task';
import { SkillLoader } from '../skills/skill-loader';

type PendingAction =
  | { type: 'new_session'; payload: Record<string, never> }
  | { type: 'schedule_task'; payload: { cron?: string } }
  | { type: 'configure_ai'; payload: { apiKey?: string; baseUrl?: string } };

export class GatewayAgent {
  private sessionManager: SessionManager;
  private taskScheduler: TaskScheduler;
  private pendingByChatId: Map<string, PendingAction> = new Map();

  constructor(sessionManager: SessionManager, taskScheduler: TaskScheduler) {
    this.sessionManager = sessionManager;
    this.taskScheduler = taskScheduler;
  }

  async handleMessage(message: string, chatId: string): Promise<{ reply: string; sessionId: string }> {
    const pending = this.pendingByChatId.get(chatId);

    if (pending?.type === 'new_session') {
      return this.handlePendingNewSession(message, chatId);
    }

    if (pending?.type === 'schedule_task') {
      return this.handlePendingTask(message, chatId, pending);
    }

    if (pending?.type === 'configure_ai') {
      return this.handlePendingConfig(message, chatId, pending);
    }

    if (message.startsWith('/')) {
      const skillResult = await this.handleSkillMessage(message);
      if (skillResult) {
        return skillResult;
      }
    }

    if (this.isConfigureIntent(message)) {
      const apiKey = this.extractApiKey(message);
      const baseUrl = this.extractBaseUrl(message);

      if (!apiKey && !baseUrl) {
        this.pendingByChatId.set(chatId, { type: 'configure_ai', payload: {} });
        return { reply: 'Provide an API key and optional base URL to configure Anthropic.', sessionId: '' };
      }

      try {
        await this.sessionManager.updateAnthropicConfig({ apiKey, baseUrl });
        return { reply: 'Anthropic configuration updated.', sessionId: '' };
      } catch (error: any) {
        if (String(error.message).includes('API key')) {
          this.pendingByChatId.set(chatId, { type: 'configure_ai', payload: { baseUrl } });
          return { reply: 'API key required. Please provide your Anthropic API key.', sessionId: '' };
        }
        return { reply: `Configuration failed: ${error.message}`, sessionId: '' };
      }
    }

    if (this.isNewSessionIntent(message)) {
      const workingDir = this.extractPath(message);
      if (!workingDir) {
        this.pendingByChatId.set(chatId, { type: 'new_session', payload: {} });
        return { reply: 'Please provide a working directory for the new session.', sessionId: '' };
      }

      const session = await this.sessionManager.createSession('New Session', workingDir, 'project');
      return { reply: `Session created: ${session.name} (${session.workingDir})`, sessionId: session.id };
    }

    if (this.isSwitchSessionIntent(message)) {
      const target = this.extractSessionIdentifier(message);
      if (!target) {
        return { reply: 'Please provide a session name or ID to switch.', sessionId: '' };
      }

      const sessions = this.sessionManager.listSessions();
      const matched = sessions.find((session) => session.id === target || session.name.includes(target));
      if (!matched) {
        return { reply: 'No matching session found.', sessionId: '' };
      }

      await this.sessionManager.switchSession(matched.id);
      return { reply: `Switched to session: ${matched.name}`, sessionId: matched.id };
    }

    if (this.isListSessionsIntent(message)) {
      const sessions = this.sessionManager.listSessions();
      if (sessions.length === 0) {
        return { reply: 'No sessions found.', sessionId: '' };
      }

      const list = sessions
        .map((session) => `- ${session.name} (${session.id}) [${session.workingDir}]`)
        .join('\n');
      return { reply: `Sessions:\n${list}`, sessionId: '' };
    }

    if (this.isScheduleTaskIntent(message)) {
      const cron = this.extractCron(message);
      const workingDir = this.extractPath(message) || this.sessionManager.listSessions().find((s) => s.id === this.sessionManager.getActiveSessionId())?.workingDir;
      if (!cron || !workingDir) {
        this.pendingByChatId.set(chatId, { type: 'schedule_task', payload: { cron: cron || '' } });
        return { reply: 'Please provide a cron time and working directory for the task.', sessionId: '' };
      }

      const task: ScheduledTask = {
        id: `task_${randomUUID()}`,
        name: 'Scheduled Task',
        cron,
        enabled: true,
        instruction: message,
        workingDir,
        context: { chatId },
        createdAt: new Date().toISOString()
      };

      await this.taskScheduler.addTask(task);
      return { reply: `Task scheduled: ${task.name} (${task.cron})`, sessionId: '' };
    }

    const response = await this.sessionManager.executeInSession(message, { sessionId: this.sessionManager.getActiveSessionId() || undefined });
    return response;
  }

  private async handlePendingNewSession(message: string, chatId: string):
    Promise<{ reply: string; sessionId: string }> {
    const workingDir = this.extractPath(message) || message.trim();
    if (!workingDir) {
      return { reply: 'Please provide a valid working directory.', sessionId: '' };
    }

    this.pendingByChatId.delete(chatId);
    const session = await this.sessionManager.createSession('New Session', workingDir, 'project');
    return { reply: `Session created: ${session.name} (${session.workingDir})`, sessionId: session.id };
  }

  private async handlePendingTask(
    message: string,
    chatId: string,
    pending: { type: 'schedule_task'; payload: { cron?: string } }
  ):
    Promise<{ reply: string; sessionId: string }> {
    const cron = pending.payload.cron || this.extractCron(message);
    const workingDir = this.extractPath(message) || message.trim();

    if (!cron || !workingDir) {
      return { reply: 'Please provide a cron time and working directory.', sessionId: '' };
    }

    const task: ScheduledTask = {
      id: `task_${randomUUID()}`,
      name: 'Scheduled Task',
      cron,
      enabled: true,
      instruction: message,
      workingDir,
      context: { chatId },
      createdAt: new Date().toISOString()
    };

    await this.taskScheduler.addTask(task);
    this.pendingByChatId.delete(chatId);
    return { reply: `Task scheduled: ${task.name} (${task.cron})`, sessionId: '' };
  }

  private async handlePendingConfig(
    message: string,
    chatId: string,
    pending: { type: 'configure_ai'; payload: { apiKey?: string; baseUrl?: string } }
  ):
    Promise<{ reply: string; sessionId: string }> {
    const apiKey = this.extractApiKey(message) || pending.payload.apiKey;
    const baseUrl = this.extractBaseUrl(message) || pending.payload.baseUrl;

    if (!apiKey && !baseUrl) {
      return { reply: 'Provide an API key and optional base URL.', sessionId: '' };
    }

    try {
      await this.sessionManager.updateAnthropicConfig({ apiKey, baseUrl });
      this.pendingByChatId.delete(chatId);
      return { reply: 'Anthropic configuration updated.', sessionId: '' };
    } catch (error: any) {
      if (String(error.message).includes('API key')) {
        this.pendingByChatId.set(chatId, { type: 'configure_ai', payload: { baseUrl } });
        return { reply: 'API key required. Please provide your Anthropic API key.', sessionId: '' };
      }
      this.pendingByChatId.delete(chatId);
      return { reply: `Configuration failed: ${error.message}`, sessionId: '' };
    }
  }

  private async handleSkillMessage(message: string): Promise<{ reply: string; sessionId: string } | null> {
    const match = message.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (!match) {
      return null;
    }

    const skillName = match[1];
    const args = match[2] || '';
    const activeSessionId = this.sessionManager.getActiveSessionId() || undefined;
    const activeSession = activeSessionId
      ? await this.sessionManager.getSession(activeSessionId)
      : null;
    const workingDir = activeSession?.metadata.workingDir || process.cwd();

    const skillLoader = new SkillLoader(os.homedir(), workingDir);
    await skillLoader.scanSkills();
    if (!skillLoader.hasSkill(skillName)) {
      return { reply: `Skill not found: ${skillName}`, sessionId: activeSessionId || '' };
    }

    const skill = await skillLoader.loadSkillContent(skillName);
    const systemAppend = `Use the following skill instructions before answering.\n\n${skill.content}`;
    const response = await this.sessionManager.executeInSession(args || 'Use the loaded skill.', {
      sessionId: activeSessionId,
      systemAppend
    });

    return response;
  }

  private isNewSessionIntent(message: string): boolean {
    return /new session|create session|new project|create project|新建会话|创建会话|新建项目|创建项目/i.test(message);
  }

  private isSwitchSessionIntent(message: string): boolean {
    return /switch session|切换会话/i.test(message);
  }

  private isListSessionsIntent(message: string): boolean {
    return /list sessions|sessions list|会话列表|查看会话/i.test(message);
  }

  private isScheduleTaskIntent(message: string): boolean {
    return /every day|daily|cron|schedule|定时|定时任务|计划任务|每天|每日|每晚|每早|每晨/i.test(message);
  }

  private isConfigureIntent(message: string): boolean {
    return /\/config|configure|config|set api key|set base url|set api/i.test(message);
  }

  private extractPath(message: string): string | null {
    const match = message.match(/(\/[^\s]+)/);
    if (!match) {
      return null;
    }
    return match[1].replace(/[。。，、；;:,.!?]+$/, '');
  }

  private extractCron(message: string): string | null {
    const cronMatch = message.match(/(\d+\s+\d+\s+\*\s+\*\s+\*)/);
    if (cronMatch) {
      return cronMatch[1];
    }

    const chineseTimeMatch = message.match(
      /(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})\s*点(?:钟)?(?:\s*(半|(\d{1,2}))\s*分?)?/
    );
    if (chineseTimeMatch) {
      const period = chineseTimeMatch[1];
      let hour = Number(chineseTimeMatch[2]);
      const minuteToken = chineseTimeMatch[3];
      let minute = 0;
      if (minuteToken) {
        minute = minuteToken === '半' ? 30 : Number(chineseTimeMatch[4] || minuteToken);
      }

      if (period) {
        if (['下午', '晚上', '中午'].includes(period) && hour < 12) {
          hour += 12;
        }
        if (['凌晨', '早上', '上午'].includes(period) && hour === 12) {
          hour = 0;
        }
        if (['晚上', '凌晨'].includes(period) && hour === 12) {
          hour = 0;
        }
      }

      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${minute} ${hour} * * *`;
      }
    }

    const timeMatch = message.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2] || '0');
      const meridian = timeMatch[3];
      if (meridian && meridian.toLowerCase() === 'pm' && hour < 12) {
        hour += 12;
      }
      if (meridian && meridian.toLowerCase() === 'am' && hour === 12) {
        hour = 0;
      }
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${minute} ${hour} * * *`;
      }
    }

    if (/every day|daily|每天|每日|每晚|每早|每晨/i.test(message)) {
      return '0 9 * * *';
    }

    return null;
  }

  private extractSessionIdentifier(message: string): string | null {
    const match = message.match(/session\s+([\w-]+)/i);
    return match ? match[1] : null;
  }

  private extractApiKey(message: string): string | undefined {
    const keyMatch = message.match(/(sk-[A-Za-z0-9_-]+)/);
    if (keyMatch) {
      return keyMatch[1];
    }
    const explicitMatch = message.match(/api[_-]?key\s*[:=]\s*([^\s]+)/i);
    return explicitMatch ? explicitMatch[1] : undefined;
  }

  private extractBaseUrl(message: string): string | undefined {
    const explicitMatch = message.match(/base\s*url\s*[:=]\s*(https?:\/\/[^\s]+)/i);
    if (explicitMatch) {
      return explicitMatch[1];
    }
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : undefined;
  }
}
