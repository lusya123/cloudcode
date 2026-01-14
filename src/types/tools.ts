export interface BashInput {
  command: string;
  timeout?: number;
  description?: string;
  run_in_background?: boolean;
}

export interface BashOutput {
  output: string;
  exitCode: number;
  killed?: boolean;
  shellId?: string;
}

export interface ReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface ReadOutput {
  content: string;
  total_lines: number;
  lines_returned: number;
}

export interface WriteInput {
  file_path: string;
  content: string;
}

export interface WriteOutput {
  message: string;
  bytes_written: number;
}

export interface EditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface EditOutput {
  message: string;
  replacements: number;
}

export interface GlobInput {
  pattern: string;
  path?: string;
}

export interface GlobOutput {
  matches: string[];
  count: number;
}

export interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
  '-i'?: boolean;
  '-n'?: boolean;
  '-B'?: number;
  '-A'?: number;
  '-C'?: number;
  head_limit?: number;
  multiline?: boolean;
}

export interface GrepOutput {
  matches: Array<{
    file: string;
    line_number?: number;
    line: string;
    before_context?: string[];
    after_context?: string[];
  }>;
  total_matches: number;
}

export interface WebFetchInput {
  url: string;
  prompt: string;
}

export interface WebFetchOutput {
  content: string;
  status: number;
}

export interface TodoWriteInput {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
}

export interface TodoWriteOutput {
  message: string;
  stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}

export interface TaskInput {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  run_in_background?: boolean;
}

export interface TaskOutput {
  result: string;
  agent_id: string;
  duration_ms?: number;
}

export interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect?: boolean;
  }>;
}

export interface AskUserQuestionOutput {
  answers: Record<string, string>;
}
