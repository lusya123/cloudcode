/**
 * Hook Types for CloudClaude
 */

// Hook event types
export type HookType =
    | 'PreToolUse'
    | 'PostToolUse'
    | 'UserPromptSubmit'
    | 'SessionStart'
    | 'SessionEnd'
    | 'Stop';

// Hook execution context
export interface HookContext {
    toolName?: string;
    input?: any;
    output?: any;
    toolUseId?: string;
    sessionId?: string;
    userMessage?: string;
}

// Hook execution result
export interface HookResult {
    decision?: 'allow' | 'block' | 'modify';
    reason?: string;
    modifiedInput?: any;
    modifiedOutput?: any;
}

// Hook function signature
export type HookFunction = (context: HookContext) => Promise<HookResult>;

// Hook matcher configuration
export interface HookMatcher {
    matcher: string | RegExp;
    hooks: HookFunction[];
    timeout?: number;
}
