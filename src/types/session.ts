export interface SessionMetadata {
  id: string;
  name: string;
  type: 'interactive' | 'project' | 'ephemeral';
  workingDir: string;
  createdAt: string;
  lastUsed: string;
  messageCount: number;
  totalTokens: number;
}

export interface SessionContext {
  environmentVariables: Record<string, string>;
  bashHistory: string[];
  currentDir: string;
  permissions: string[];
}

export interface SessionCheckpoint {
  id: string;
  timestamp: string;
  files: Array<{
    path: string;
    content: string;
    operation: 'create' | 'modify' | 'delete';
  }>;
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: any;
}
