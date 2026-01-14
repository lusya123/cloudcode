export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  instruction: string;
  workingDir: string;
  context?: Record<string, unknown> & { chatId?: string };
  sessionId?: string | null;
  createdAt: string;
}

export interface TasksConfig {
  tasks: ScheduledTask[];
}

export type TaskLogStatus = 'success' | 'error' | 'running';

export interface TaskLogEntry {
  timestamp: string;
  status: TaskLogStatus;
  message: string;
}
