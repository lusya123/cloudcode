export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  type: string;
  workingDir: string;
  createdAt: string;
  lastUsed: string;
  messageCount: number;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface HistoryDetailResponse {
  session: SessionSummary;
  messages: ChatMessage[];
}

export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  instruction: string;
  workingDir: string;
  createdAt: string;
}

export interface TasksResponse {
  tasks: ScheduledTask[];
}

export interface StatusResponse {
  uptime: string;
  activeSessions: number;
  taskCount: number;
  cpu: number;
  memory: number;
  disk: number;
}
