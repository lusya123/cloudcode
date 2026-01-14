export interface Credentials {
  feishu: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken?: string;
  };
}

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

export interface SessionsConfig {
  lastActive: string | null;
  sessions: SessionMetadata[];
}
