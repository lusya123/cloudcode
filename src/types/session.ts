import type { SessionMetadata } from './config';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface SessionRecord {
  metadata: SessionMetadata;
  messages: SessionMessage[];
}
