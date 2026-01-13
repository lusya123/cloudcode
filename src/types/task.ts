/**
 * Task Types for CloudClaude
 */

// Scheduled task definition
export interface Task {
    id: string;
    name: string;
    cron: string;
    enabled: boolean;
    instruction: string;
    workingDir: string;
    context?: Record<string, any>;
    sessionId?: string | null;
    createdAt: string;
    lastRun?: string;
    lastStatus?: 'success' | 'error';
}

// Tasks configuration file
export interface TasksConfig {
    tasks: Task[];
}

// Task execution result
export interface TaskExecutionResult {
    taskId: string;
    success: boolean;
    result: string;
    startTime: string;
    endTime: string;
    duration: number;
    error?: string;
}

// Task execution log entry
export interface TaskLogEntry {
    timestamp: string;
    taskId: string;
    taskName: string;
    status: 'started' | 'success' | 'error';
    message: string;
    duration?: number;
}
