/**
 * Tool Types for CloudClaude
 * Defines input/output schemas for all agent tools
 */

// ============ Bash Tool ============
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

// ============ Read Tool ============
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

// ============ Write Tool ============
export interface WriteInput {
    file_path: string;
    content: string;
}

export interface WriteOutput {
    message: string;
    bytes_written: number;
}

// ============ Edit Tool ============
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

// ============ Glob Tool ============
export interface GlobInput {
    pattern: string;
    path?: string;
}

export interface GlobOutput {
    matches: string[];
    count: number;
}

// ============ Grep Tool ============
export interface GrepInput {
    pattern: string;
    path?: string;
    glob?: string;
    output_mode?: 'content' | 'files_with_matches' | 'count';
    '-i'?: boolean;       // ignore case
    '-n'?: boolean;       // show line numbers
    '-B'?: number;        // before context
    '-A'?: number;        // after context
    '-C'?: number;        // context (before and after)
    head_limit?: number;
    multiline?: boolean;
}

export interface GrepMatch {
    file: string;
    line_number?: number;
    line: string;
    before_context?: string[];
    after_context?: string[];
}

export interface GrepOutput {
    matches: GrepMatch[];
    total_matches: number;
}

// ============ WebFetch Tool ============
export interface WebFetchInput {
    url: string;
    prompt: string;
}

export interface WebFetchOutput {
    content: string;
    status: number;
}

// ============ TodoWrite Tool ============
export interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
}

export interface TodoWriteInput {
    todos: TodoItem[];
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

// ============ Task Tool (Sub-agent) ============
export interface TaskToolInput {
    description: string;
    prompt: string;
    subagent_type: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    run_in_background?: boolean;
}

export interface TaskToolOutput {
    result: string;
    agent_id: string;
    duration_ms?: number;
}

// ============ AskUserQuestion Tool ============
export interface QuestionOption {
    label: string;
    description: string;
}

export interface UserQuestion {
    question: string;
    header: string;
    options: QuestionOption[];
    multiSelect?: boolean;
}

export interface AskUserQuestionInput {
    questions: UserQuestion[];
}

export interface AskUserQuestionOutput {
    answers: Record<string, string>;
}

// ============ Skill Tool ============
export interface SkillInput {
    skill: string;
    args?: string;
}

export interface SkillOutput {
    name: string;
    description: string;
    content: string;
    source: 'global' | 'project';
    path: string;
}

// ============ Tool Definition ============
export type ToolName =
    | 'Bash'
    | 'Read'
    | 'Write'
    | 'Edit'
    | 'Glob'
    | 'Grep'
    | 'WebFetch'
    | 'TodoWrite'
    | 'Task'
    | 'AskUserQuestion'
    | 'Skill';

export type ToolInput =
    | BashInput
    | ReadInput
    | WriteInput
    | EditInput
    | GlobInput
    | GrepInput
    | WebFetchInput
    | TodoWriteInput
    | TaskToolInput
    | AskUserQuestionInput
    | SkillInput;

export type ToolOutput =
    | BashOutput
    | ReadOutput
    | WriteOutput
    | EditOutput
    | GlobOutput
    | GrepOutput
    | WebFetchOutput
    | TodoWriteOutput
    | TaskToolOutput
    | AskUserQuestionOutput
    | SkillOutput;
