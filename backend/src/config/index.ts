import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

export interface Config {
    server: {
        port: number;
        host: string;
    };
    feishu: {
        appId: string;
        appSecret: string;
        encryptKey: string;
        verificationToken: string;
    };
    claude: {
        apiKey: string;
        model: string;
        baseURL?: string;
    };
    workspace: {
        root: string;
    };
}

let config: Config;

export const getConfigPath = (): string => {
    return process.env.CONFIG_PATH || path.join(process.cwd(), 'config.yaml');
};

export const loadConfig = (): Config => {
    // Always reload from file to ensure freshness
    const configPath = getConfigPath();

    if (fs.existsSync(configPath)) {
        try {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            const yamlConfig = yaml.load(fileContents) as any;

            config = {
                server: {
                    port: yamlConfig.server?.port || parseInt(process.env.PORT || '3000'),
                    host: yamlConfig.server?.host || process.env.HOST || '0.0.0.0',
                },
                feishu: {
                    appId: yamlConfig.feishu?.appId || process.env.FEISHU_APP_ID || '',
                    appSecret: yamlConfig.feishu?.appSecret || process.env.FEISHU_APP_SECRET || '',
                    encryptKey: yamlConfig.feishu?.encryptKey || process.env.FEISHU_ENCRYPT_KEY || '',
                    verificationToken: yamlConfig.feishu?.verificationToken || process.env.FEISHU_VERIFICATION_TOKEN || '',
                },
                claude: {
                    apiKey: yamlConfig.claude?.apiKey || process.env.ANTHROPIC_API_KEY || '',
                    model: yamlConfig.claude?.model || process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
                    baseURL: yamlConfig.claude?.baseURL || process.env.CLAUDE_BASE_URL || undefined,
                },
                workspace: {
                    root: yamlConfig.workspace?.root || process.env.WORKSPACE_ROOT || path.join(process.cwd(), 'workspace'),
                }
            };

            logger.info('Configuration loaded successfully');
        } catch (e) {
            logger.error('Error loading config file:', e);
            throw e;
        }
    } else {
        logger.warn('Config file not found, using defaults/environment variables');
        config = {
            server: {
                port: parseInt(process.env.PORT || '3000'),
                host: process.env.HOST || '0.0.0.0',
            },
            feishu: {
                appId: process.env.FEISHU_APP_ID || '',
                appSecret: process.env.FEISHU_APP_SECRET || '',
                encryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
                verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || '',
            },
            claude: {
                apiKey: process.env.ANTHROPIC_API_KEY || '',
                model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
            },
            workspace: {
                root: process.env.WORKSPACE_ROOT || path.join(process.cwd(), 'workspace'),
            }
        };
    }

    // Create workspace directory if not exists
    if (!fs.existsSync(config.workspace.root)) {
        try {
            fs.mkdirSync(config.workspace.root, { recursive: true });
        } catch (e) {
            logger.error(`Failed to create workspace directory: ${config.workspace.root}`, e);
        }
    }

    return config;
};

export const saveConfig = (newConfig: Partial<Config>): void => {
    const currentConfig = loadConfig();

    // Deep merge (simplified)
    const updatedConfig = {
        ...currentConfig,
        ...newConfig,
        feishu: { ...currentConfig.feishu, ...newConfig.feishu },
        claude: { ...currentConfig.claude, ...newConfig.claude },
    };

    const yamlStr = yaml.dump(updatedConfig);
    fs.writeFileSync(getConfigPath(), yamlStr, 'utf8');

    // Reload to memory
    config = updatedConfig;
    logger.info('Configuration saved and reloaded');
};

export default loadConfig;
