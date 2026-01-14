export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop';

export interface HookContext {
  toolName?: string;
  input?: unknown;
  output?: unknown;
  toolUseId?: string;
  sessionId?: string;
  userMessage?: string;
}

export interface HookResult {
  decision?: 'allow' | 'block' | 'modify';
  reason?: string;
  modifiedInput?: unknown;
  modifiedOutput?: unknown;
}

export type HookFunction = (context: HookContext) => Promise<HookResult>;

export interface HookMatcher {
  matcher: string | RegExp;
  hooks: HookFunction[];
  timeout?: number;
}
