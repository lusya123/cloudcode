/**
 * Session Types for CloudClaude
 */

// Session type classification
export type SessionType = 'interactive' | 'project' | 'ephemeral';

// Session metadata (stored in sessions.json)
export interface SessionMetadata {
    id: string;
    name: string;
    type: SessionType;
    workingDir: string;
    createdAt: string;
    lastUsed: string;
    messageCount: number;
    totalTokens?: number;
}

// Sessions configuration file
export interface SessionsConfig {
    lastActive: string | null;
    sessions: SessionMetadata[];
}

// Session execution context
export interface SessionContext {
    environmentVariables: Record<string, string>;
    bashHistory: string[];
    currentDir: string;
    permissions: string[];
}

// Message in session history
export interface SessionMessage {
    role: 'user' | 'assistant';
    content: any;  // Can be string or tool_use blocks
    timestamp: string;
}

// File operation for checkpoints
export interface FileOperation {
    path: string;
    content: string;
    operation: 'create' | 'modify' | 'delete';
}

// Session checkpoint for rollback
export interface SessionCheckpoint {
    id: string;
    timestamp: string;
    files: FileOperation[];
}

// Complete session data (for persistence)
export interface SessionData {
    metadata: SessionMetadata;
    context: SessionContext;
    messages: SessionMessage[];
}

// Session execution result
export interface SessionExecutionResult {
    success: boolean;
    result: string;
    tokensUsed?: number;
    duration?: number;
}
