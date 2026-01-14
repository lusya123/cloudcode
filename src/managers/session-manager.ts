import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { AgenticLoop } from '../core/agentic-loop';
import { ContextCompactor } from './context-compactor';
import { SubagentExecutor } from '../agents/subagent-executor';
import { PermissionChecker } from '../security/permission-checker';
import { CommandFilter } from '../security/command-filter';
import { ClaudeMdLoader } from '../utils/claude-md-loader';
import { loadPermissions, loadProviderConfig, loadSessions, saveSessions } from '../utils/config-loader';
import type { SessionMessage, SessionMetadata } from '../types/session';
import type { SessionsConfig } from '../types/config';
import type { McpClient } from '../mcp/mcp-client';
import type { ProviderConfig } from '../types/provider';
import { Logger } from '../utils/logger';

interface SessionManagerOptions {
  dataDir: string;
  tools: Anthropic.Tool[];
  mcpClient?: McpClient;
  maxConcurrentSessions?: number;
  providerConfig?: ProviderConfig;
}

export class SessionManager {
  private runningSessions: Map<
    string,
    { loop: AgenticLoop; metadata: SessionMetadata; lastUsed: number }
  > = new Map();
  private maxConcurrentSessions: number;
  private dataDir: string;
  private tools: Anthropic.Tool[];
  private sessionsConfig: SessionsConfig;
  private permissionChecker: PermissionChecker;
  private commandFilter: CommandFilter;
  private compactor: ContextCompactor;
  private claudeMdLoader: ClaudeMdLoader;
  private subagentExecutor: SubagentExecutor;
  private mcpClient?: McpClient;
  private providerConfig: ProviderConfig;
  private model: string;
  private logger: Logger;

  constructor(options: SessionManagerOptions) {
    this.dataDir = options.dataDir;
    this.tools = options.tools;
    this.mcpClient = options.mcpClient;
    this.maxConcurrentSessions = options.maxConcurrentSessions || 3;
    this.sessionsConfig = loadSessions();
    const permissions = loadPermissions();
    this.permissionChecker = new PermissionChecker(permissions.permissions);
    this.commandFilter = new CommandFilter();
    this.providerConfig = options.providerConfig || loadProviderConfig();
    this.model = this.providerConfig.model || 'claude-sonnet-4-20250514';
    this.compactor = new ContextCompactor(this.model);
    this.claudeMdLoader = new ClaudeMdLoader();
    this.subagentExecutor = new SubagentExecutor({}, this.tools, {
      permissionChecker: this.permissionChecker,
      commandFilter: this.commandFilter,
      mcpClient: this.mcpClient,
      contextCompactor: this.compactor,
      defaultModel: this.model
    });
    this.logger = new Logger('SessionManager');
  }

  async createSession(name: string, workingDir: string, type: SessionMetadata['type']): Promise<SessionMetadata> {
    const id = `session_${Date.now()}`;
    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      id,
      name,
      type,
      workingDir,
      createdAt: now,
      lastUsed: now,
      messageCount: 0,
      totalTokens: 0
    };

    this.sessionsConfig.sessions.push(metadata);
    this.sessionsConfig.lastActive = id;
    saveSessions(this.sessionsConfig);

    const sessionDir = this.getSessionDir(id);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(path.join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    await fs.writeFile(path.join(sessionDir, 'messages.json'), JSON.stringify([], null, 2));
    await fs.writeFile(path.join(sessionDir, 'context.json'), JSON.stringify({}, null, 2));

    return metadata;
  }

  listSessions(): SessionMetadata[] {
    return [...this.sessionsConfig.sessions];
  }

  async getSession(sessionId: string): Promise<SessionMetadata | undefined> {
    return this.sessionsConfig.sessions.find(session => session.id === sessionId);
  }

  getActiveSessionId(): string | null {
    return this.sessionsConfig.lastActive;
  }

  async setActiveSession(sessionId: string): Promise<void> {
    this.sessionsConfig.lastActive = sessionId;
    saveSessions(this.sessionsConfig);
  }

  async executeInSession(sessionId: string, instruction: string): Promise<string> {
    const { loop, metadata } = await this.ensureSessionLoaded(sessionId);
    const result = await loop.run(instruction);

    const messages = loop.getMessages();
    await this.persistSessionMessages(sessionId, messages);
    await this.updateSessionMetadata(metadata, messages.length);

    return result;
  }

  async executeEphemeralTask(instruction: string, workingDir: string): Promise<string> {
    const loop = await this.createLoop(workingDir, []);
    return loop.run(instruction);
  }

  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    const filePath = path.join(this.getSessionDir(sessionId), 'messages.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as SessionMessage[];
    } catch {
      return [];
    }
  }

  private async ensureSessionLoaded(sessionId: string): Promise<{ loop: AgenticLoop; metadata: SessionMetadata }> {
    const existing = this.runningSessions.get(sessionId);
    if (existing) {
      existing.lastUsed = Date.now();
      return { loop: existing.loop, metadata: existing.metadata };
    }

    if (this.runningSessions.size >= this.maxConcurrentSessions) {
      await this.evictLRUSession();
    }

    const metadata = await this.getSession(sessionId);
    if (!metadata) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const messages = await this.getSessionMessages(sessionId);
    const loop = await this.createLoop(metadata.workingDir, messages);

    this.runningSessions.set(sessionId, {
      loop,
      metadata,
      lastUsed: Date.now()
    });

    return { loop, metadata };
  }

  private async createLoop(workingDir: string, messages: SessionMessage[]): Promise<AgenticLoop> {
    const claudeMd = await this.claudeMdLoader.load(workingDir);
    const systemPrompt = claudeMd
      ? `${this.getBaseSystemPrompt()}\n\n${claudeMd}`
      : this.getBaseSystemPrompt();

    return new AgenticLoop({
      workingDir,
      tools: this.tools,
      systemPrompt,
      initialMessages: messages,
      permissionChecker: this.permissionChecker,
      commandFilter: this.commandFilter,
      mcpClient: this.mcpClient,
      subagentExecutor: this.subagentExecutor,
      contextCompactor: this.compactor,
      client: this.createClient(),
      model: this.model
    });
  }

  private async evictLRUSession(): Promise<void> {
    let oldestSessionId: string | null = null;
    let oldestTime = Infinity;

    for (const [sessionId, entry] of this.runningSessions) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestSessionId = sessionId;
      }
    }

    if (!oldestSessionId) {
      return;
    }

    const entry = this.runningSessions.get(oldestSessionId);
    if (entry) {
      await this.persistSessionMessages(oldestSessionId, entry.loop.getMessages());
    }

    this.runningSessions.delete(oldestSessionId);
    this.logger.info(`Evicted session ${oldestSessionId} due to concurrency limits`);
  }

  private async persistSessionMessages(sessionId: string, messages: SessionMessage[]): Promise<void> {
    const filePath = path.join(this.getSessionDir(sessionId), 'messages.json');
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2));
  }

  private async updateSessionMetadata(metadata: SessionMetadata, messageCount: number): Promise<void> {
    metadata.lastUsed = new Date().toISOString();
    metadata.messageCount = messageCount;

    const index = this.sessionsConfig.sessions.findIndex(session => session.id === metadata.id);
    if (index >= 0) {
      this.sessionsConfig.sessions[index] = metadata;
      saveSessions(this.sessionsConfig);
    }

    const sessionDir = this.getSessionDir(metadata.id);
    await fs.writeFile(path.join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  }

  private getSessionDir(sessionId: string): string {
    return path.join(this.dataDir, 'sessions', sessionId);
  }

  private getBaseSystemPrompt(): string {
    return `You are CloudClaude, an AI assistant running on a cloud server.
Follow the project instructions, use tools when needed, and ask for confirmation for risky operations.`;
  }

  private createClient(): Anthropic {
    return new Anthropic({
      apiKey: this.providerConfig.apiKey || process.env.ANTHROPIC_API_KEY || undefined,
      baseURL: this.providerConfig.baseUrl || process.env.ANTHROPIC_BASE_URL || undefined
    });
  }

  updateProviderConfig(config: ProviderConfig): void {
    this.providerConfig = config;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.compactor.setModel(this.model);
    this.subagentExecutor.setDefaultModel(this.model);

    if (config.apiKey) {
      process.env.ANTHROPIC_API_KEY = config.apiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (config.baseUrl) {
      process.env.ANTHROPIC_BASE_URL = config.baseUrl;
    } else {
      delete process.env.ANTHROPIC_BASE_URL;
    }

    for (const entry of this.runningSessions.values()) {
      entry.loop.updateClient(this.createClient());
      entry.loop.updateModel(this.model);
    }
  }
}
