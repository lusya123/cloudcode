/**
 * Session Manager for CloudClaude
 * Creates, manages, and persists Claude Agent sessions
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { AgenticLoop } from '../core/agentic-loop';
import { createDefaultHooksManager } from '../core/hooks-manager';
import { loadSessions, saveSessions, loadCredentials } from '../utils/config-loader';
import { Logger } from '../utils/logger';
import {
    SessionMetadata,
    SessionsConfig,
    SessionData,
    SessionExecutionResult
} from '../types/session';
import { Task } from '../types/task';

const logger = new Logger('SessionManager');
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

export class SessionManager {
    private sessionsConfig: SessionsConfig = { lastActive: null, sessions: [] };
    private runningSessions: Map<string, AgenticLoop> = new Map();
    private maxConcurrentSessions: number;

    constructor(maxConcurrent: number = 3, _timeoutMs: number = 3600000) {
        this.maxConcurrentSessions = maxConcurrent;
    }

    /**
     * Initialize session manager
     */
    async init(): Promise<void> {
        this.sessionsConfig = await loadSessions();
        logger.info(`Loaded ${this.sessionsConfig.sessions.length} sessions`);
    }

    /**
     * Create a new session
     */
    async createSession(name: string, workingDir: string, type: 'interactive' | 'project' = 'interactive'): Promise<SessionMetadata> {
        const sessionId = `session_${Date.now()}`;
        const metadata: SessionMetadata = {
            id: sessionId,
            name,
            type,
            workingDir,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            messageCount: 0
        };

        // Create session data directory
        const sessionDir = path.join(DATA_DIR, 'sessions', sessionId);
        await fs.mkdir(sessionDir, { recursive: true });

        // Save initial metadata
        await this.saveSessionData(sessionId, {
            metadata,
            context: {
                environmentVariables: {},
                bashHistory: [],
                currentDir: workingDir,
                permissions: []
            },
            messages: []
        });

        // Update sessions config
        this.sessionsConfig.sessions.push(metadata);
        this.sessionsConfig.lastActive = sessionId;
        await saveSessions(this.sessionsConfig);

        logger.info(`Created session: ${sessionId} (${name})`);
        return metadata;
    }

    /**
     * Get or load a session
     */
    async getSession(sessionId: string): Promise<AgenticLoop | null> {
        // Check if already running
        if (this.runningSessions.has(sessionId)) {
            return this.runningSessions.get(sessionId)!;
        }

        // Find session metadata
        const metadata = this.sessionsConfig.sessions.find(s => s.id === sessionId);
        if (!metadata) {
            logger.warn(`Session not found: ${sessionId}`);
            return null;
        }

        // Check concurrent limit
        if (this.runningSessions.size >= this.maxConcurrentSessions) {
            await this.evictLRUSession();
        }

        // Load credentials for API configuration
        const credentials = await loadCredentials();

        // Load and create session with credentials
        const loop = new AgenticLoop({
            workingDir: metadata.workingDir,
            hooks: createDefaultHooksManager(),
            apiKey: credentials.anthropic.apiKey,
            baseUrl: credentials.anthropic.baseUrl,
            model: credentials.anthropic.model
        });
        await loop.init();

        // Restore messages if available
        const sessionData = await this.loadSessionData(sessionId);
        if (sessionData && sessionData.messages.length > 0) {
            loop.setMessages(sessionData.messages.map(m => ({
                role: m.role,
                content: m.content
            })));
        }

        this.runningSessions.set(sessionId, loop);
        logger.info(`Loaded session: ${sessionId}`);

        return loop;
    }

    /**
     * Execute in a session
     */
    async executeInSession(sessionId: string, instruction: string): Promise<SessionExecutionResult> {
        const startTime = Date.now();

        const loop = await this.getSession(sessionId);
        if (!loop) {
            return {
                success: false,
                result: `Session not found: ${sessionId}`
            };
        }

        try {
            const result = await loop.run(instruction);

            // Update session metadata
            await this.updateSessionMetadata(sessionId, {
                lastUsed: new Date().toISOString(),
                messageCount: loop.getMessages().length
            });

            // Persist messages
            await this.persistSessionMessages(sessionId, loop.getMessages());

            return {
                success: true,
                result,
                duration: Date.now() - startTime
            };
        } catch (error: any) {
            logger.error(`Execution failed in session ${sessionId}`, error);
            return {
                success: false,
                result: `Error: ${error.message}`,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Execute ephemeral task (no persistent session)
     */
    async executeEphemeralTask(task: Task): Promise<string> {
        // Load credentials for API configuration
        const credentials = await loadCredentials();

        const loop = new AgenticLoop({
            workingDir: task.workingDir,
            hooks: createDefaultHooksManager(),
            maxTurns: 50,
            apiKey: credentials.anthropic.apiKey,
            baseUrl: credentials.anthropic.baseUrl,
            model: credentials.anthropic.model
        });
        await loop.init();

        // Build instruction with context
        let instruction = task.instruction;
        if (task.context) {
            instruction += `\n\nContext:\n${JSON.stringify(task.context, null, 2)}`;
        }

        try {
            const result = await loop.run(instruction);
            logger.info(`Ephemeral task completed: ${task.name}`);
            return result;
        } catch (error: any) {
            logger.error(`Ephemeral task failed: ${task.name}`, error);
            throw error;
        }
    }

    /**
     * Get all sessions
     */
    getSessions(): SessionMetadata[] {
        return this.sessionsConfig.sessions;
    }

    /**
     * Get active session ID
     */
    getActiveSessionId(): string | null {
        return this.sessionsConfig.lastActive;
    }

    /**
     * Set active session
     */
    async setActiveSession(sessionId: string): Promise<void> {
        if (!this.sessionsConfig.sessions.find(s => s.id === sessionId)) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        this.sessionsConfig.lastActive = sessionId;
        await saveSessions(this.sessionsConfig);
    }

    /**
     * Evict least recently used session
     */
    private async evictLRUSession(): Promise<void> {
        let oldest: { id: string; time: number } | null = null;

        for (const [id] of this.runningSessions) {
            const meta = this.sessionsConfig.sessions.find(s => s.id === id);
            if (meta) {
                const time = new Date(meta.lastUsed).getTime();
                if (!oldest || time < oldest.time) {
                    oldest = { id, time };
                }
            }
        }

        if (oldest) {
            const loop = this.runningSessions.get(oldest.id);
            if (loop) {
                await this.persistSessionMessages(oldest.id, loop.getMessages());
            }
            this.runningSessions.delete(oldest.id);
            logger.info(`Evicted LRU session: ${oldest.id}`);
        }
    }

    /**
     * Update session metadata
     */
    private async updateSessionMetadata(sessionId: string, updates: Partial<SessionMetadata>): Promise<void> {
        const index = this.sessionsConfig.sessions.findIndex(s => s.id === sessionId);
        if (index !== -1) {
            this.sessionsConfig.sessions[index] = {
                ...this.sessionsConfig.sessions[index],
                ...updates
            };
            await saveSessions(this.sessionsConfig);
        }
    }

    /**
     * Load session data from disk
     */
    private async loadSessionData(sessionId: string): Promise<SessionData | null> {
        try {
            const messagesPath = path.join(DATA_DIR, 'sessions', sessionId, 'messages.json');
            const content = await fs.readFile(messagesPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * Save session data to disk
     */
    private async saveSessionData(sessionId: string, data: SessionData): Promise<void> {
        const sessionDir = path.join(DATA_DIR, 'sessions', sessionId);
        await fs.mkdir(sessionDir, { recursive: true });
        await fs.writeFile(
            path.join(sessionDir, 'messages.json'),
            JSON.stringify(data, null, 2)
        );
    }

    /**
     * Persist session messages
     */
    private async persistSessionMessages(sessionId: string, messages: any[]): Promise<void> {
        const sessionData = await this.loadSessionData(sessionId) || {
            metadata: this.sessionsConfig.sessions.find(s => s.id === sessionId)!,
            context: { environmentVariables: {}, bashHistory: [], currentDir: '', permissions: [] },
            messages: []
        };

        sessionData.messages = messages.map(m => ({
            ...m,
            timestamp: new Date().toISOString()
        }));

        await this.saveSessionData(sessionId, sessionData);
    }
}
