import express from 'express';
import cors from 'cors';
import { Config } from './config';
import { GatewayAgent } from './core/gateway';
import { SessionManager } from './core/session';
import { TaskScheduler } from './core/scheduler';
import { createRoutes } from './routes/api';
import { createSettingsRoutes } from './routes/settings';
import logger from './utils/logger';

export const createApp = (config: Config) => {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Core Components
    const sessionManager = new SessionManager(config.workspace.root);
    // Restore sessions from disk
    sessionManager.loadSessions().catch(err => {
        logger.error('Failed to restore sessions:', err);
    });

    const scheduler = new TaskScheduler();
    const gateway = new GatewayAgent(config, sessionManager, scheduler);

    // Routes
    app.use('/api', createRoutes(gateway, sessionManager, scheduler));
    app.use('/api/settings', createSettingsRoutes(gateway));

    // Webhook Route (Feishu)
    app.post('/webhook', (req, res) => {
        logger.info('Received webhook:', req.body);
        // Implement Feishu Event verification and handling here
        res.json({ code: 0, msg: 'success' });
    });

    return app;
};
