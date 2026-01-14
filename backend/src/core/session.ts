import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { ToolExecutor } from '../executors/tool-executor';
import path from 'path';
import fs from 'fs';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface Session {
    id: string;
    userId: string;  // Feishu OpenID
    name: string;
    workingDir: string;
    createdAt: number;
    lastUsed: number;
    messages: Message[];
    status: 'active' | 'archived';
    currentModel?: {
        name: string;
        apiKey?: string;
        baseURL?: string;
    };
}

export class SessionManager {
    private sessions: Map<string, Session> = new Map();
    private executors: Map<string, ToolExecutor> = new Map();
    private baseWorkspace: string;

    constructor(baseWorkspace: string) {
        this.baseWorkspace = baseWorkspace;
    }

    /**
     * Create or get a session
     */
    async getOrCreateSession(userId: string, sessionId?: string): Promise<Session> {
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastUsed = Date.now();
            await this.saveSession(session);
            return session;
        }

        // Create new session
        const id = sessionId || uuidv4();
        const workingDir = path.join(this.baseWorkspace, id);

        // Ensure directory exists
        if (!fs.existsSync(workingDir)) {
            fs.mkdirSync(workingDir, { recursive: true });
        }

        const session: Session = {
            id,
            userId,
            name: `Session ${id.substring(0, 8)}`,
            workingDir,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            messages: [],
            status: 'active'
        };

        this.sessions.set(id, session);
        await this.saveSession(session);

        // Initialize executor for this session
        const executor = new ToolExecutor(workingDir);
        await executor.init();
        this.executors.set(id, executor);

        logger.info(`Session created: ${id} for user ${userId}`);
        return session;
    }

    /**
     * Add message to history
     */
    async addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages.push({
                role,
                content,
                timestamp: Date.now()
            });
            session.lastUsed = Date.now();
            await this.saveSession(session);
        }
    }

    /**
     * Get messages
     */
    getHistory(sessionId: string): Message[] {
        return this.sessions.get(sessionId)?.messages || [];
    }

    /**
     * Get Executor for session
     */
    getExecutor(sessionId: string): ToolExecutor | undefined {
        return this.executors.get(sessionId);
    }

    /**
     * List sessions for user
     */
    getUserSessions(userId: string): Session[] {
        return Array.from(this.sessions.values())
            .filter(s => s.userId === userId)
            .sort((a, b) => b.lastUsed - a.lastUsed);
    }

    /**
     * Save session to file
     */
    private async saveSession(session: Session): Promise<void> {
        try {
            const sessionFile = path.join(session.workingDir, 'session.json');
            await fs.promises.writeFile(sessionFile, JSON.stringify(session, null, 2), 'utf8');
        } catch (error) {
            logger.error(`Failed to save session ${session.id}:`, error);
        }
    }

    /**
     * Load all sessions from workspace
     */
    async loadSessions(): Promise<void> {
        try {
            if (!fs.existsSync(this.baseWorkspace)) {
                return;
            }

            const entries = await fs.promises.readdir(this.baseWorkspace, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const sessionDir = path.join(this.baseWorkspace, entry.name);
                    const sessionFile = path.join(sessionDir, 'session.json');

                    if (fs.existsSync(sessionFile)) {
                        try {
                            const content = await fs.promises.readFile(sessionFile, 'utf8');
                            const session = JSON.parse(content) as Session;

                            // Restore session to memory
                            this.sessions.set(session.id, session);

                            // Initialize executor
                            const executor = new ToolExecutor(sessionDir);
                            await executor.init();
                            this.executors.set(session.id, executor);

                            logger.info(`Loaded session ${session.id}`);
                        } catch (e) {
                            logger.error(`Error loading session from ${sessionFile}:`, e);
                        }
                    }
                }
            }
            logger.info(`Restored ${this.sessions.size} sessions from disk`);
        } catch (error) {
            logger.error('Failed to load sessions:', error);
        }
    }
}
