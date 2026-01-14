export interface SessionSummary {
  id: string;
  name: string;
  type: 'interactive' | 'project' | 'ephemeral';
  workingDir: string;
  createdAt: string;
  lastUsed: string;
  messageCount: number;
  totalTokens: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
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

export interface StatusInfo {
  uptime: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  sessions: SessionSummary[];
  tasks: ScheduledTask[];
}
