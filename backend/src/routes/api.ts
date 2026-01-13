import express from 'express';
import { GatewayAgent } from '../core/gateway';
import { SessionManager } from '../core/session';
import { TaskScheduler } from '../core/scheduler';
import logger from '../utils/logger';

export const createRoutes = (
    gateway: GatewayAgent,
    sessionManager: SessionManager,
    scheduler: TaskScheduler
) => {
    const router = express.Router();

    // Chat API
    router.post('/chat', async (req, res) => {
        try {
            const { message, sessionId } = req.body;
            const result = await gateway.processMessage(sessionId, message);
            // If the agent created a new session, return that ID so frontend can switch
            res.json({ reply: result.content, sessionId: result.newSessionId || sessionId });
        } catch (error) {
            logger.error('Chat API Error:', error);
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // History API
    router.get('/history', (req, res) => {
        // Mock user ID for now
        const sessions = sessionManager.getUserSessions('user_default');
        res.json({ sessions });
    });

    router.get('/history/:id', (req, res) => {
        const session = sessionManager.getOrCreateSession('user_default', req.params.id);
        // @ts-ignore
        const messages = sessionManager.getHistory(req.params.id);
        res.json({ session, messages });
    });

    // Tasks API
    router.get('/tasks', (req, res) => {
        const tasks = scheduler.getTasks();
        res.json({ tasks });
    });

    router.post('/tasks/:id/trigger', (req, res) => {
        // Trigger task logic stub
        res.json({ message: 'Task triggered' });
    });

    // Status API
    router.get('/status', (req, res) => {
        res.json({
            uptime: process.uptime(),
            activeSessions: 0, // Implement real count
            taskCount: scheduler.getTasks().length,
            cpu: 0,
            memory: 0,
            disk: 0
        });
    });

    return router;
};
