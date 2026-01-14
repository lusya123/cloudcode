export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop';

export interface HookMatcher {
  matcher: string | RegExp;
  hooks: HookFunction[];
  timeout?: number;
}

export type HookFunction = (context: HookContext) => Promise<HookResult>;

export interface HookContext {
  toolName?: string;
  input?: any;
  output?: any;
  toolUseId?: string;
  sessionId?: string;
  userMessage?: string;
}

export interface HookResult {
  decision?: 'allow' | 'block' | 'modify';
  reason?: string;
  modifiedInput?: any;
  modifiedOutput?: any;
}
