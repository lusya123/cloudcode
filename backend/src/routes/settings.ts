import express from 'express';
import { Config, loadConfig, saveConfig } from '../config';
import { GatewayAgent } from '../core/gateway';
import logger from '../utils/logger';

export const createSettingsRoutes = (gateway: GatewayAgent) => {
    const router = express.Router();

    // GET /api/settings
    router.get('/', (req, res) => {
        try {
            const config = loadConfig();
            // Mask secrets
            const safeConfig = {
                ...config,
                feishu: {
                    ...config.feishu,
                    appSecret: '******',
                    encryptKey: '******',
                    verificationToken: '******'
                },
                claude: {
                    ...config.claude,
                    apiKey: '******'
                }
            };
            res.json(safeConfig);
        } catch (error) {
            logger.error('Error getting settings:', error);
            res.status(500).json({ error: 'Failed to load settings' });
        }
    });

    // POST /api/settings
    router.post('/', (req, res) => {
        try {
            const newConfig = req.body as Partial<Config>;

            // Load current config to handle secrets not provided (if user sends ****** or empty)
            const currentConfig = loadConfig();

            if (newConfig.claude?.apiKey === '******') {
                newConfig.claude.apiKey = currentConfig.claude.apiKey;
            }

            if (newConfig.feishu) {
                if (newConfig.feishu.appSecret === '******') newConfig.feishu.appSecret = currentConfig.feishu.appSecret;
                if (newConfig.feishu.encryptKey === '******') newConfig.feishu.encryptKey = currentConfig.feishu.encryptKey;
                if (newConfig.feishu.verificationToken === '******') newConfig.feishu.verificationToken = currentConfig.feishu.verificationToken;
            }

            saveConfig(newConfig);

            // Update runtime components
            const updatedConfig = loadConfig();
            gateway.updateConfig(updatedConfig);

            res.json({ message: 'Settings updated successfully' });
        } catch (error) {
            logger.error('Error saving settings:', error);
            res.status(500).json({ error: 'Failed to save settings' });
        }
    });

    return router;
};
