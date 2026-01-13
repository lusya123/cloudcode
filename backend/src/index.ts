import { loadConfig } from './config';
import { createApp } from './app';
import logger from './utils/logger';

const startServer = async () => {
    try {
        const config = loadConfig();
        const app = createApp(config);

        app.listen(config.server.port, config.server.host, () => {
            logger.info(`Server running at http://${config.server.host}:${config.server.port}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
