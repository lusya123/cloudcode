/**
 * CloudClaude Main Entry Point
 * Express server with Feishu Webhook handling
 */

import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { FeishuAdapter } from './adapters/feishu-adapter';
import { SessionManager } from './managers/session-manager';
import { TaskScheduler } from './scheduler/task-scheduler';
import { GatewayAgent } from './agents/gateway-agent';
import { loadCredentials, loadAppConfig } from './utils/config-loader';
import { Logger } from './utils/logger';
import { FeishuMessageEvent, FeishuUrlVerification } from './types/feishu';

const logger = new Logger('Server');

// Message deduplication cache
const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL = 60000; // 1 minute

async function main() {
    logger.info('Starting CloudClaude...');

    // Load configuration
    const appConfig = loadAppConfig();

    let credentials;
    try {
        credentials = await loadCredentials();
    } catch (error) {
        logger.error('Failed to load credentials. Please run `npm run init` first.');
        process.exit(1);
    }

    // Initialize components
    const feishuAdapter = new FeishuAdapter(
        credentials.feishu,
        appConfig.defaultChatId
    );

    const sessionManager = new SessionManager(
        appConfig.maxConcurrentSessions,
        appConfig.sessionTimeoutMs
    );
    await sessionManager.init();

    const taskScheduler = new TaskScheduler(feishuAdapter, sessionManager);
    await taskScheduler.init();

    const gatewayAgent = new GatewayAgent(
        feishuAdapter,
        sessionManager,
        taskScheduler,
        process.cwd()
    );

    // Create Express app
    const app = express();
    app.use(bodyParser.json());

    // CORS middleware for frontend access
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });

    // Health check endpoint
    app.get('/health', async (_req: Request, res: Response) => {
        const tasks = await taskScheduler.getTasks();
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            activeSessions: sessionManager.getSessions().length,
            scheduledTasks: tasks.filter(t => t.enabled).length
        });
    });

    // Feishu Webhook endpoint
    app.post('/webhook/feishu', async (req: Request, res: Response) => {
        const body = req.body;

        // URL verification (first-time setup)
        if (body.type === 'url_verification') {
            const verification = body as FeishuUrlVerification;
            logger.info('URL verification request received');
            res.json({ challenge: verification.challenge });
            return;
        }

        // Immediately respond to prevent timeout
        res.json({ code: 0 });

        // Process message asynchronously
        processMessageAsync(body, gatewayAgent);
    });

    // Manual task trigger endpoint
    app.post('/api/tasks/:taskId/trigger', async (req: Request, res: Response) => {
        const { taskId } = req.params;

        try {
            await taskScheduler.triggerTask(taskId);
            res.json({ success: true, message: 'Task triggered' });
        } catch (error: any) {
            res.status(404).json({ success: false, error: error.message });
        }
    });

    // Get tasks endpoint
    app.get('/api/tasks', async (_req: Request, res: Response) => {
        const tasks = await taskScheduler.getTasks();
        res.json({ tasks });
    });

    // Get sessions endpoint
    app.get('/api/sessions', (_req: Request, res: Response) => {
        const sessions = sessionManager.getSessions();
        const activeId = sessionManager.getActiveSessionId();
        res.json({ sessions, activeId });
    });

    // Get session messages endpoint
    app.get('/api/sessions/:sessionId/messages', async (req: Request, res: Response) => {
        const { sessionId } = req.params;
        try {
            const messages = await sessionManager.getSessionMessages(sessionId);
            res.json({ messages, sessionId });
        } catch (error: any) {
            res.status(404).json({ error: error.message });
        }
    });

    // Create new session endpoint
    app.post('/api/sessions', async (req: Request, res: Response) => {
        const { name, workingDir } = req.body;

        const timestamp = new Date().toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const sessionName = name || `对话 ${timestamp}`;
        const dir = workingDir || process.cwd();

        try {
            const session = await sessionManager.createSession(sessionName, dir, 'interactive');
            res.json({ session, success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message, success: false });
        }
    });

    // Helper function to detect new session intent
    const isNewSessionIntent = (message: string): boolean => {
        return /^(创建|新建|开启|开始).*(项目|会话|session|对话)/i.test(message) ||
            /^新(会话|对话)$/i.test(message) ||
            /(开启|开始)新的?(会话|对话)/i.test(message);
    };

    // Chat endpoint for frontend
    app.post('/api/chat', async (req: Request, res: Response) => {
        const { message, sessionId } = req.body;

        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        try {
            // Check if user wants to create a new session
            if (isNewSessionIntent(message)) {
                const timestamp = new Date().toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const newSession = await sessionManager.createSession(
                    `对话 ${timestamp}`,
                    process.cwd(),
                    'interactive'
                );

                res.json({
                    reply: `✅ 已创建新会话：${newSession.name}\n\n📁 会话 ID: ${newSession.id}\n📂 工作目录: ${newSession.workingDir}\n\n现在可以开始新的对话了！`,
                    sessionId: newSession.id,
                    success: true,
                    isNewSession: true
                });
                return;
            }

            let activeSessionId = sessionId || sessionManager.getActiveSessionId();

            // Create default session if none exists
            if (!activeSessionId) {
                const session = await sessionManager.createSession(
                    '默认会话',
                    process.cwd(),
                    'interactive'
                );
                activeSessionId = session.id;
            }

            // Execute in session
            const result = await sessionManager.executeInSession(activeSessionId, message);

            res.json({
                reply: result.result,
                sessionId: activeSessionId,
                success: result.success,
                duration: result.duration
            });
        } catch (error: any) {
            logger.error('Chat error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get status endpoint
    app.get('/api/status', async (_req: Request, res: Response) => {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const tasks = await taskScheduler.getTasks();

        res.json({
            uptime: `${hours}h ${minutes}m`,
            uptimeSeconds: uptime,
            activeSessions: sessionManager.getSessions().length,
            taskCount: tasks.length,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        });
    });

    // Start server
    app.listen(appConfig.port, () => {
        logger.info(`CloudClaude server running on port ${appConfig.port}`);
        logger.info(`Environment: ${appConfig.nodeEnv}`);
        logger.info(`Max concurrent sessions: ${appConfig.maxConcurrentSessions}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down...');
        taskScheduler.stopAll();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down...');
        taskScheduler.stopAll();
        process.exit(0);
    });
}

/**
 * Process message asynchronously
 */
async function processMessageAsync(
    body: FeishuMessageEvent,
    gatewayAgent: GatewayAgent
): Promise<void> {
    try {
        // Check for valid message event
        if (body.header?.event_type !== 'im.message.receive_v1') {
            return;
        }

        const messageId = body.event?.message?.message_id;
        if (!messageId) {
            return;
        }

        // Deduplication check
        if (processedMessages.has(messageId)) {
            logger.debug(`Duplicate message ignored: ${messageId}`);
            return;
        }
        processedMessages.set(messageId, Date.now());

        // Clean up old entries
        cleanupProcessedMessages();

        // Parse and handle message
        const adapter = new FeishuAdapter({ appId: '', appSecret: '' }); // Temporary for parsing
        const parsed = adapter.parseMessage(body);

        if (!parsed) {
            return;
        }

        logger.info(`Processing message from ${parsed.senderId}: ${parsed.text.substring(0, 50)}`);

        // Handle through gateway agent
        await gatewayAgent.handleMessage(parsed);

    } catch (error: any) {
        logger.error('Failed to process message:', error);
    }
}

/**
 * Clean up old processed message entries
 */
function cleanupProcessedMessages(): void {
    const now = Date.now();
    for (const [id, time] of processedMessages) {
        if (now - time > MESSAGE_DEDUP_TTL) {
            processedMessages.delete(id);
        }
    }
}

// Run main
main().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});
