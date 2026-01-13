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
    addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages.push({
                role,
                content,
                timestamp: Date.now()
            });
            session.lastUsed = Date.now();
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
}
