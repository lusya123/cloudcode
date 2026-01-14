export type SessionType = 'interactive' | 'project' | 'ephemeral';

export interface Credentials {
  feishu: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken?: string;
  };
  anthropic: {
    apiKey: string;
    baseUrl?: string;
  };
}

export interface SessionMetadata {
  id: string;
  name: string;
  type: SessionType;
  workingDir: string;
  createdAt: string;
  lastUsed: string;
  messageCount: number;
}

export interface SessionsConfig {
  lastActive: string | null;
  sessions: SessionMetadata[];
}

export interface PermissionsRules {
  deny: string[];
  allow: string[];
  ask: string[];
}

export interface PermissionsConfig {
  permissions: PermissionsRules;
}

export interface McpServerConfig {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
}

export interface McpServersConfig {
  servers: McpServerConfig[];
}
