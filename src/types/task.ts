export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  instruction: string;
  workingDir: string;
  context?: Record<string, any>;
  sessionId?: string | null;
  createdAt: string;
}

export interface TasksConfig {
  tasks: ScheduledTask[];
}
