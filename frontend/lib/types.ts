/**
 * Frontend Type Definitions
 */

// Session type
export interface Session {
    id: string;
    name: string;
    type: 'interactive' | 'project' | 'ephemeral';
    workingDir: string;
    createdAt: string;
    lastUsed: string;
    messageCount: number;
}

// Task type
export interface Task {
    id: string;
    name: string;
    cron: string;
    enabled: boolean;
    instruction: string;
    workingDir: string;
    createdAt: string;
    lastRun?: string;
    lastStatus?: 'success' | 'error';
}

// Message type
export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

// System status
export interface SystemStatus {
    uptime: string;
    uptimeSeconds: number;
    activeSessions: number;
    taskCount: number;
    memory?: {
        heapUsed: number;
        heapTotal: number;
    };
}

// API response types
export interface ChatResponse {
    reply: string;
    sessionId: string;
}

export interface SessionsResponse {
    sessions: Session[];
    activeId: string | null;
}

export interface TasksResponse {
    tasks: Task[];
}

export interface TaskLog {
    timestamp: string;
    taskId: string;
    taskName: string;
    status: 'started' | 'success' | 'error';
    message: string;
    duration?: number;
}
