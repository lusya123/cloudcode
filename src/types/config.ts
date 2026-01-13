/**
 * Configuration Types for CloudClaude
 */

// Feishu credentials configuration
export interface FeishuCredentials {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
}

// Anthropic API configuration (dynamically configurable)
export interface AnthropicCredentials {
  apiKey: string;
  baseUrl?: string;  // Optional: custom API endpoint (e.g., for proxies)
  model?: string;    // Optional: default model to use
}

// Complete credentials configuration
export interface CredentialsConfig {
  feishu: FeishuCredentials;
  anthropic: AnthropicCredentials;
}

// Permission rule configuration
export interface PermissionConfig {
  deny: string[];
  allow: string[];
  ask: string[];
}

// MCP server configuration
export interface McpServerConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
}

// MCP servers configuration file
export interface McpServersConfig {
  servers: Record<string, McpServerConfig>;
}

// Application configuration
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production';
  defaultChatId?: string;
  maxConcurrentSessions: number;
  sessionTimeoutMs: number;
  logLevel: string;
}
