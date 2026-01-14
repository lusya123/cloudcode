/**
 * Configuration Loader for CloudClaude
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
    CredentialsConfig,
    PermissionConfig,
    McpServersConfig,
    AppConfig
} from '../types/config';
import { TasksConfig } from '../types/task';
import { SessionsConfig } from '../types/session';
import { Logger } from './logger';

const logger = new Logger('ConfigLoader');

// Default config directory
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');

/**
 * Load JSON configuration file
 */
async function loadJsonConfig<T>(filename: string, defaultValue?: T): Promise<T> {
    const filePath = path.join(CONFIG_DIR, filename);

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && defaultValue !== undefined) {
            logger.warn(`Config file not found: ${filename}, using default`);
            return defaultValue;
        }
        throw new Error(`Failed to load config file ${filename}: ${error}`);
    }
}

/**
 * Save JSON configuration file
 */
async function saveJsonConfig<T>(filename: string, data: T): Promise<void> {
    const filePath = path.join(CONFIG_DIR, filename);

    // Ensure config directory exists
    await fs.mkdir(CONFIG_DIR, { recursive: true });

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info(`Config saved: ${filename}`);
}

/**
 * Load credentials configuration
 */
export async function loadCredentials(): Promise<CredentialsConfig> {
    return loadJsonConfig<CredentialsConfig>('credentials.json');
}

/**
 * Save credentials configuration
 */
export async function saveCredentials(config: CredentialsConfig): Promise<void> {
    await saveJsonConfig('credentials.json', config);
}

/**
 * Update Anthropic API configuration dynamically
 * This allows the Agent to update its own API settings
 */
export async function updateAnthropicConfig(updates: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}): Promise<void> {
    const current = await loadCredentials();

    // Update only provided fields
    if (updates.apiKey) current.anthropic.apiKey = updates.apiKey;
    if (updates.baseUrl !== undefined) current.anthropic.baseUrl = updates.baseUrl;
    if (updates.model !== undefined) current.anthropic.model = updates.model;

    await saveCredentials(current);
    logger.info('Anthropic configuration updated', {
        hasApiKey: !!updates.apiKey,
        baseUrl: updates.baseUrl,
        model: updates.model
    });
}

/**
 * Get all pre-configured models
 */
export async function getConfiguredModels(): Promise<{ name: string; model: string; baseUrl?: string }[]> {
    const credentials = await loadCredentials();
    return (credentials.models || []).map(m => ({
        name: m.name,
        model: m.model,
        baseUrl: m.baseUrl
    }));
}

/**
 * Find model configuration by name (case-insensitive, fuzzy match)
 */
export async function findModelByName(name: string): Promise<{
    name: string;
    apiKey: string;
    baseUrl?: string;
    model: string;
} | null> {
    const credentials = await loadCredentials();
    const models = credentials.models || [];

    const lowerName = name.toLowerCase().trim();

    // Try exact match first
    let found = models.find(m => m.name.toLowerCase() === lowerName);

    // Try partial match if no exact match
    if (!found) {
        found = models.find(m =>
            m.name.toLowerCase().includes(lowerName) ||
            lowerName.includes(m.name.toLowerCase())
        );
    }

    return found || null;
}

/**
 * Switch to a pre-configured model by name
 * Updates the current anthropic configuration to use the specified model
 */
export async function switchToModel(modelName: string): Promise<{
    success: boolean;
    message: string;
    modelConfig?: { name: string; model: string; baseUrl?: string };
}> {
    const modelConfig = await findModelByName(modelName);

    if (!modelConfig) {
        const available = await getConfiguredModels();
        const availableNames = available.map(m => m.name).join(', ');
        return {
            success: false,
            message: `未找到模型 "${modelName}"。可用模型: ${availableNames || '(无预配置模型)'}`
        };
    }

    // Update current anthropic config to use this model
    await updateAnthropicConfig({
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        model: modelConfig.model
    });

    logger.info(`Switched to model: ${modelConfig.name}`, {
        model: modelConfig.model,
        baseUrl: modelConfig.baseUrl
    });

    return {
        success: true,
        message: `已切换到模型: ${modelConfig.name} (${modelConfig.model})`,
        modelConfig: {
            name: modelConfig.name,
            model: modelConfig.model,
            baseUrl: modelConfig.baseUrl
        }
    };
}

/**
 * Load permissions configuration
 */
export async function loadPermissions(): Promise<PermissionConfig> {
    const defaultPermissions: PermissionConfig = {
        deny: [],
        allow: ['Read(**)', 'Glob(**)', 'Grep(**)'],
        ask: ['Write(**)', 'Edit(**)', 'Bash(*)']
    };

    try {
        const config = await loadJsonConfig<{ permissions: PermissionConfig }>('permissions.json');
        return config.permissions;
    } catch {
        return defaultPermissions;
    }
}

/**
 * Load tasks configuration
 */
export async function loadTasks(): Promise<TasksConfig> {
    const defaultTasks: TasksConfig = { tasks: [] };
    return loadJsonConfig<TasksConfig>('tasks.json', defaultTasks);
}

/**
 * Save tasks configuration
 */
export async function saveTasks(config: TasksConfig): Promise<void> {
    await saveJsonConfig('tasks.json', config);
}

/**
 * Load sessions configuration
 */
export async function loadSessions(): Promise<SessionsConfig> {
    const defaultSessions: SessionsConfig = {
        lastActive: null,
        sessions: []
    };
    return loadJsonConfig<SessionsConfig>('sessions.json', defaultSessions);
}

/**
 * Save sessions configuration
 */
export async function saveSessions(config: SessionsConfig): Promise<void> {
    await saveJsonConfig('sessions.json', config);
}

/**
 * Load MCP servers configuration
 */
export async function loadMcpServers(): Promise<McpServersConfig> {
    const defaultConfig: McpServersConfig = { servers: {} };
    return loadJsonConfig<McpServersConfig>('mcp-servers.json', defaultConfig);
}

/**
 * Load application configuration from environment
 */
export function loadAppConfig(): AppConfig {
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: (process.env.NODE_ENV as 'development' | 'production') || 'development',
        defaultChatId: process.env.DEFAULT_CHAT_ID,
        maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3', 10),
        sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000', 10),
        logLevel: process.env.LOG_LEVEL || 'info'
    };
}

/**
 * Check if configuration files exist
 */
export async function checkConfigExists(): Promise<{
    credentials: boolean;
    tasks: boolean;
    sessions: boolean;
    permissions: boolean;
}> {
    const checkFile = async (filename: string): Promise<boolean> => {
        try {
            await fs.access(path.join(CONFIG_DIR, filename));
            return true;
        } catch {
            return false;
        }
    };

    return {
        credentials: await checkFile('credentials.json'),
        tasks: await checkFile('tasks.json'),
        sessions: await checkFile('sessions.json'),
        permissions: await checkFile('permissions.json')
    };
}
