import fs from 'fs';
import path from 'path';
import type { Credentials, SessionsConfig } from '../types/config';
import type { TasksConfig } from '../types/task';
import type { ProviderConfig } from '../types/provider';

export interface PermissionsConfig {
  permissions: {
    deny: string[];
    allow: string[];
    ask: string[];
  };
}

export interface McpServersConfig {
  servers: Record<
    string,
    {
      type: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      description?: string;
    }
  >;
}

const DEFAULT_CONFIG_DIR = path.join(process.cwd(), 'config');

export function getConfigDir(): string {
  return process.env.CONFIG_DIR || DEFAULT_CONFIG_DIR;
}

export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function loadCredentials(): Credentials {
  const filePath = path.join(getConfigDir(), 'credentials.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('credentials.json not found. Run `npm run init` first.');
  }
  return readJsonFile<Credentials>(filePath);
}

export function loadTasks(): TasksConfig {
  const filePath = path.join(getConfigDir(), 'tasks.json');
  if (!fs.existsSync(filePath)) {
    return { tasks: [] };
  }
  return readJsonFile<TasksConfig>(filePath);
}

export function saveTasks(tasks: TasksConfig): void {
  ensureConfigDir();
  const filePath = path.join(getConfigDir(), 'tasks.json');
  writeJsonFile(filePath, tasks);
}

export function loadSessions(): SessionsConfig {
  const filePath = path.join(getConfigDir(), 'sessions.json');
  if (!fs.existsSync(filePath)) {
    return { lastActive: null, sessions: [] };
  }
  return readJsonFile<SessionsConfig>(filePath);
}

export function saveSessions(sessions: SessionsConfig): void {
  ensureConfigDir();
  const filePath = path.join(getConfigDir(), 'sessions.json');
  writeJsonFile(filePath, sessions);
}

export function loadPermissions(): PermissionsConfig {
  const filePath = path.join(getConfigDir(), 'permissions.json');
  if (!fs.existsSync(filePath)) {
    return {
      permissions: {
        deny: [],
        allow: ['Read(**)', 'Glob(**)', 'Grep(**)'],
        ask: ['Write(**)', 'Edit(**)', 'Bash(*)']
      }
    };
  }
  return readJsonFile<PermissionsConfig>(filePath);
}

export function loadMcpServers(): McpServersConfig {
  const filePath = path.join(getConfigDir(), 'mcp-servers.json');
  if (!fs.existsSync(filePath)) {
    return { servers: {} };
  }
  return readJsonFile<McpServersConfig>(filePath);
}

export function saveMcpServers(config: McpServersConfig): void {
  ensureConfigDir();
  const filePath = path.join(getConfigDir(), 'mcp-servers.json');
  writeJsonFile(filePath, config);
}

export function loadProviderConfig(): ProviderConfig {
  const filePath = path.join(getConfigDir(), 'providers.json');
  if (!fs.existsSync(filePath)) {
    return {
      provider: 'anthropic',
      apiKey: '',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514'
    };
  }
  return readJsonFile<ProviderConfig>(filePath);
}

export function saveProviderConfig(config: ProviderConfig): void {
  ensureConfigDir();
  const filePath = path.join(getConfigDir(), 'providers.json');
  writeJsonFile(filePath, config);
}
