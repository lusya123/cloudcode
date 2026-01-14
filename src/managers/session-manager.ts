import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { Logger } from 'winston';
import type { Credentials, SessionMetadata, SessionsConfig } from '../types/config';
import type { SessionMessage, SessionRecord } from '../types/session';
import type { ScheduledTask } from '../types/task';
import { loadCredentials, loadPermissions, loadSessions, saveCredentials, saveSessions } from '../utils/config-loader';
import { ClaudeMdLoader } from '../utils/claude-md-loader';
import { ContextCompactor } from './context-compactor';
import { FileCheckpointer } from './file-checkpointer';
import { PermissionChecker } from '../security/permission-checker';
import { CommandFilter } from '../security/command-filter';
import { PathValidator } from '../security/path-validator';
import { SkillLoader } from '../skills/skill-loader';
import { ToolExecutor } from '../executors/tool-executor';
import { AgenticLoop } from '../core/agentic-loop';
import { HooksManager } from '../core/hooks-manager';
import { SubagentExecutor } from '../agents/subagent-executor';

interface SessionManagerOptions {
  dataDir?: string;
  logger?: Logger;
  hooksManager?: HooksManager;
}

interface RunOptions {
  sessionId?: string;
  workingDir?: string;
  model?: string;
  systemAppend?: string;
}

export class SessionManager {
  private dataDir: string;
  private logger?: Logger;
  private hooksManager?: HooksManager;
  private sessionsConfig: SessionsConfig = { lastActive: null, sessions: [] };
  private anthropicClient?: Anthropic;
  private permissions?: PermissionChecker;
  private commandFilter = new CommandFilter();
  private contextCompactor = new ContextCompactor();
  private fileCheckpointer: FileCheckpointer;
  private claudeMdLoader = new ClaudeMdLoader();
  private runningSessions = new Map<string, number>();
  private maxConcurrent = Number(process.env.MAX_CONCURRENT_SESSIONS || 3);
  private subagentExecutor: SubagentExecutor;

  constructor(options?: SessionManagerOptions) {
    this.dataDir = options?.dataDir || path.join(process.cwd(), 'data');
    this.logger = options?.logger;
    this.hooksManager = options?.hooksManager;
    this.fileCheckpointer = new FileCheckpointer(this.dataDir);
    this.subagentExecutor = new SubagentExecutor(async (prompt, model, workingDir) => {
      return this.executeEphemeralInstruction(prompt, { model, workingDir });
    });
  }

  async init(): Promise<void> {
    this.sessionsConfig = await loadSessions();
    const credentials = await loadCredentials();
    this.anthropicClient = this.createAnthropicClient(credentials.anthropic);
    const permissionsConfig = await loadPermissions();
    this.permissions = new PermissionChecker(permissionsConfig.permissions);
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'sessions'), { recursive: true });
  }

  listSessions(): SessionMetadata[] {
    return [...this.sessionsConfig.sessions];
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const metadata = this.sessionsConfig.sessions.find((session) => session.id === sessionId);
    if (!metadata) {
      return null;
    }

    const messages = await this.loadMessages(sessionId);
    return { metadata, messages };
  }

  getActiveSessionId(): string | null {
    return this.sessionsConfig.lastActive;
  }

  async createSession(name: string, workingDir: string, type: SessionMetadata['type'] = 'interactive'):
    Promise<SessionMetadata> {
    const id = `session_${randomUUID()}`;
    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      id,
      name,
      type,
      workingDir,
      createdAt: now,
      lastUsed: now,
      messageCount: 0
    };

    this.sessionsConfig.sessions.push(metadata);
    this.sessionsConfig.lastActive = id;
    try {
      await fs.mkdir(workingDir, { recursive: true });
    } catch {
      // ignore directory creation errors
    }
    await saveSessions(this.sessionsConfig);
    await this.writeSessionMetadata(metadata);
    await this.saveMessages(id, []);

    return metadata;
  }

  async switchSession(sessionId: string): Promise<SessionMetadata | null> {
    const metadata = this.sessionsConfig.sessions.find((session) => session.id === sessionId);
    if (!metadata) {
      return null;
    }

    this.sessionsConfig.lastActive = sessionId;
    await saveSessions(this.sessionsConfig);
    return metadata;
  }

  async executeInSession(instruction: string, options?: RunOptions): Promise<{ reply: string; sessionId: string }> {
    if (!this.anthropicClient || !this.permissions) {
      throw new Error('SessionManager not initialized');
    }

    let sessionId = options?.sessionId || this.sessionsConfig.lastActive;
    let session = sessionId
      ? this.sessionsConfig.sessions.find((item) => item.id === sessionId)
      : undefined;

    if (!session) {
      const newSession = await this.createSession('Default Session', options?.workingDir || process.cwd());
      sessionId = newSession.id;
      session = newSession;
    }

    await this.trackSessionUsage(session.id);

    const messages = await this.loadMessages(session.id);
    const compacted = this.contextCompactor.compact(messages);

    const skillLoader = new SkillLoader(os.homedir(), session.workingDir);
    await skillLoader.scanSkills();
    const skillsPrompt = skillLoader.generateSkillsPrompt();

    const claudeMd = await this.claudeMdLoader.load(session.workingDir);

    const systemPrompt = this.buildSystemPrompt({
      workingDir: session.workingDir,
      skillsPrompt,
      claudeMd,
      summary: compacted.summary,
      append: options?.systemAppend
    });

    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: any }> = compacted.messages.map(
      (msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })
    );

    anthropicMessages.push({ role: 'user', content: instruction });

    const pathValidator = new PathValidator(session.workingDir, [this.dataDir]);
    const toolExecutor = new ToolExecutor({
      workingDir: session.workingDir,
      permissionChecker: this.permissions,
      commandFilter: this.commandFilter,
      pathValidator,
      fileCheckpointer: this.fileCheckpointer,
      hooksManager: this.hooksManager,
      skillLoader,
      subagentExecutor: this.subagentExecutor,
      logger: this.logger
    });

    const agentLoop = new AgenticLoop(this.anthropicClient, toolExecutor, {
      systemPrompt,
      model: options?.model
    });

    const result = await agentLoop.run({
      messages: anthropicMessages,
      sessionId: session.id
    });

    const now = new Date().toISOString();
    const newMessages: SessionMessage[] = [
      {
        id: randomUUID(),
        role: 'user',
        content: instruction,
        createdAt: now
      },
      {
        id: randomUUID(),
        role: 'assistant',
        content: result.reply,
        createdAt: now
      }
    ];

    const updatedMessages = [...messages, ...newMessages];
    await this.saveMessages(session.id, updatedMessages);

    session.lastUsed = now;
    session.messageCount = updatedMessages.length;
    await this.writeSessionMetadata(session);
    await saveSessions(this.sessionsConfig);

    return { reply: result.reply, sessionId: session.id };
  }

  async executeEphemeralTask(task: ScheduledTask): Promise<string> {
    return this.executeEphemeralInstruction(task.instruction, {
      workingDir: task.workingDir,
      model: undefined
    });
  }

  async executeEphemeralInstruction(prompt: string, options?: { workingDir?: string; model?: string }):
    Promise<string> {
    if (!this.anthropicClient || !this.permissions) {
      throw new Error('SessionManager not initialized');
    }

    const workingDir = options?.workingDir || process.cwd();
    const sessionId = `ephemeral_${randomUUID()}`;

    const skillLoader = new SkillLoader(os.homedir(), workingDir);
    await skillLoader.scanSkills();
    const skillsPrompt = skillLoader.generateSkillsPrompt();

    const claudeMd = await this.claudeMdLoader.load(workingDir);

    const systemPrompt = this.buildSystemPrompt({
      workingDir,
      skillsPrompt,
      claudeMd
    });

    const pathValidator = new PathValidator(workingDir, [this.dataDir]);
    const toolExecutor = new ToolExecutor({
      workingDir,
      permissionChecker: this.permissions,
      commandFilter: this.commandFilter,
      pathValidator,
      fileCheckpointer: this.fileCheckpointer,
      hooksManager: this.hooksManager,
      skillLoader,
      subagentExecutor: this.subagentExecutor,
      logger: this.logger
    });

    const agentLoop = new AgenticLoop(this.anthropicClient, toolExecutor, {
      systemPrompt,
      model: options?.model
    });

    const result = await agentLoop.run({
      messages: [{ role: 'user', content: prompt }],
      sessionId
    });

    return result.reply;
  }

  async updateAnthropicConfig(update: { apiKey?: string; baseUrl?: string }): Promise<void> {
    const credentials = await loadCredentials();
    const apiKey = update.apiKey || credentials.anthropic.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key is required.');
    }

    const baseUrl = update.baseUrl ?? credentials.anthropic.baseUrl;

    const updated = {
      ...credentials,
      anthropic: {
        apiKey,
        baseUrl
      }
    };

    await saveCredentials(updated);
    this.anthropicClient = this.createAnthropicClient(updated.anthropic);
  }

  private createAnthropicClient(credentials: Credentials['anthropic']): Anthropic {
    const baseUrl = credentials.baseUrl || undefined;
    const apiKey = credentials.apiKey;
    const useBearer = baseUrl ? /open\.bigmodel\.cn/i.test(baseUrl) : false;

    return new Anthropic({
      apiKey: useBearer ? undefined : apiKey,
      authToken: useBearer ? apiKey : undefined,
      baseURL: baseUrl
    });
  }

  private async trackSessionUsage(sessionId: string): Promise<void> {
    this.runningSessions.set(sessionId, Date.now());
    if (this.runningSessions.size > this.maxConcurrent) {
      await this.evictLRUSession();
    }
  }

  private async evictLRUSession(): Promise<void> {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, time] of this.runningSessions.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.runningSessions.delete(oldestId);
    }
  }

  private async loadMessages(sessionId: string): Promise<SessionMessage[]> {
    const filePath = this.getMessagesPath(sessionId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as SessionMessage[];
    } catch {
      return [];
    }
  }

  private async saveMessages(sessionId: string, messages: SessionMessage[]): Promise<void> {
    const filePath = this.getMessagesPath(sessionId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2));
  }

  private async writeSessionMetadata(metadata: SessionMetadata): Promise<void> {
    const filePath = this.getMetadataPath(metadata.id);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  }

  private getSessionDir(sessionId: string): string {
    return path.join(this.dataDir, 'sessions', sessionId);
  }

  private getMessagesPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'messages.json');
  }

  private getMetadataPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'metadata.json');
  }

  private buildSystemPrompt(params: {
    workingDir: string;
    skillsPrompt?: string;
    claudeMd?: string;
    summary?: string;
    append?: string;
  }): string {
    const parts: string[] = [
      'You are CloudClaude, a cloud-hosted assistant with tool access.',
      `Working directory: ${params.workingDir}.`,
      'Use tools when necessary. Ask for confirmation before destructive actions.',
      params.summary ? `Context summary: ${params.summary}` : ''
    ];

    if (params.skillsPrompt) {
      parts.push(params.skillsPrompt);
    }

    if (params.claudeMd) {
      parts.push(`\n## Project Memory\n\n${params.claudeMd}`);
    }

    if (params.append) {
      parts.push(params.append);
    }

    return parts.filter(Boolean).join('\n\n');
  }
}
