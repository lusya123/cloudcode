import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  Credentials,
  SessionsConfig,
  PermissionsConfig,
  McpServersConfig
} from '../types/config';
import type { TasksConfig } from '../types/task';

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.join(CONFIG_DIR, fileName);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  const filePath = path.join(CONFIG_DIR, fileName);
  await ensureConfigDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function loadCredentials(): Promise<Credentials> {
  const filePath = path.join(CONFIG_DIR, 'credentials.json');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as Credentials;
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await writeJsonFile('credentials.json', credentials);
}

export async function loadTasks(): Promise<TasksConfig> {
  return readJsonFile<TasksConfig>('tasks.json', { tasks: [] });
}

export async function saveTasks(tasks: TasksConfig): Promise<void> {
  await writeJsonFile('tasks.json', tasks);
}

export async function loadSessions(): Promise<SessionsConfig> {
  return readJsonFile<SessionsConfig>('sessions.json', { lastActive: null, sessions: [] });
}

export async function saveSessions(sessions: SessionsConfig): Promise<void> {
  await writeJsonFile('sessions.json', sessions);
}

export async function loadPermissions(): Promise<PermissionsConfig> {
  const fallback: PermissionsConfig = {
    permissions: {
      deny: [
        'Bash(rm -rf /)',
        'Bash(dd if=*)',
        'Bash(mkfs.*)',
        'Bash(shutdown*)',
        'Bash(reboot*)',
        'Read(/etc/shadow)',
        'Read(/etc/passwd)',
        'Write(/etc/*)',
        'Write(/usr/*)',
        'Write(/bin/*)'
      ],
      allow: [
        'Read(**)',
        'Glob(**)',
        'Grep(**)',
        'Bash(ls *)',
        'Bash(cat *)',
        'Bash(pwd)',
        'Bash(whoami)',
        'Bash(npm *)',
        'Bash(node *)',
        'Bash(python *)',
        'Bash(git *)'
      ],
      ask: [
        'Bash(apt *)',
        'Bash(pip install *)',
        'Bash(curl *)',
        'Bash(wget *)',
        'Write(**)',
        'Edit(**)'
      ]
    }
  };

  return readJsonFile<PermissionsConfig>('permissions.json', fallback);
}

export async function loadMcpServers(): Promise<McpServersConfig> {
  return readJsonFile<McpServersConfig>('mcp-servers.json', { servers: [] });
}
