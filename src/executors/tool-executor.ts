import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import axios from 'axios';
import type { Logger } from 'winston';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type {
  BashInput,
  BashOutput,
  ReadInput,
  ReadOutput,
  WriteInput,
  WriteOutput,
  EditInput,
  EditOutput,
  GlobInput,
  GlobOutput,
  GrepInput,
  GrepOutput,
  WebFetchInput,
  WebFetchOutput,
  TodoWriteInput,
  TodoWriteOutput,
  TaskInput,
  TaskOutput,
  AskUserQuestionInput,
  AskUserQuestionOutput,
  SkillInput,
  SkillOutput,
  ToolName
} from '../types/tools';
import { PermissionRequiredError, ToolBlockedError, UserInputRequiredError } from '../errors';
import type { PermissionChecker } from '../security/permission-checker';
import type { CommandFilter } from '../security/command-filter';
import type { PathValidator } from '../security/path-validator';
import type { HooksManager } from '../core/hooks-manager';
import type { FileCheckpointer } from '../managers/file-checkpointer';
import type { SkillLoader } from '../skills/skill-loader';
import type { SubagentExecutor } from '../agents/subagent-executor';

interface ToolExecutionContext {
  sessionId?: string;
}

interface ToolExecutorOptions {
  workingDir: string;
  permissionChecker: PermissionChecker;
  commandFilter: CommandFilter;
  pathValidator: PathValidator;
  fileCheckpointer?: FileCheckpointer;
  hooksManager?: HooksManager;
  skillLoader: SkillLoader;
  subagentExecutor?: SubagentExecutor;
  logger?: Logger;
}

export class ToolExecutor {
  private workingDir: string;
  private permissionChecker: PermissionChecker;
  private commandFilter: CommandFilter;
  private pathValidator: PathValidator;
  private fileCheckpointer?: FileCheckpointer;
  private hooksManager?: HooksManager;
  private skillLoader: SkillLoader;
  private subagentExecutor?: SubagentExecutor;
  private logger?: Logger;
  private todoPath: string;

  constructor(options: ToolExecutorOptions) {
    this.workingDir = options.workingDir;
    this.permissionChecker = options.permissionChecker;
    this.commandFilter = options.commandFilter;
    this.pathValidator = options.pathValidator;
    this.fileCheckpointer = options.fileCheckpointer;
    this.hooksManager = options.hooksManager;
    this.skillLoader = options.skillLoader;
    this.subagentExecutor = options.subagentExecutor;
    this.logger = options.logger;
    this.todoPath = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'todos.json');
  }

  getToolDefinitions(): Tool[] {
    const tools: Tool[] = [
      {
        name: 'Bash',
        description: 'Execute shell commands on the server.',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            timeout: { type: 'number' },
            description: { type: 'string' },
            run_in_background: { type: 'boolean' }
          },
          required: ['command']
        }
      },
      {
        name: 'Read',
        description: 'Read a text file with optional line offsets.',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            offset: { type: 'number' },
            limit: { type: 'number' }
          },
          required: ['file_path']
        }
      },
      {
        name: 'Write',
        description: 'Write a file to disk, overwriting if it exists.',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['file_path', 'content']
        }
      },
      {
        name: 'Edit',
        description: 'Replace text in a file.',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            replace_all: { type: 'boolean' }
          },
          required: ['file_path', 'old_string', 'new_string']
        }
      },
      {
        name: 'Glob',
        description: 'Find files matching a glob pattern.',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            path: { type: 'string' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'Grep',
        description: 'Search files for a regex pattern.',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            path: { type: 'string' },
            glob: { type: 'string' },
            output_mode: { type: 'string' },
            '-i': { type: 'boolean' },
            '-n': { type: 'boolean' },
            '-B': { type: 'number' },
            '-A': { type: 'number' },
            '-C': { type: 'number' },
            head_limit: { type: 'number' },
            multiline: { type: 'boolean' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'WebFetch',
        description: 'Fetch content from a URL.',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            prompt: { type: 'string' }
          },
          required: ['url', 'prompt']
        }
      },
      {
        name: 'TodoWrite',
        description: 'Update the todo list.',
        input_schema: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  status: { type: 'string' },
                  activeForm: { type: 'string' }
                },
                required: ['content', 'status', 'activeForm']
              }
            }
          },
          required: ['todos']
        }
      },
      {
        name: 'Task',
        description: 'Run a subagent task.',
        input_schema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            prompt: { type: 'string' },
            subagent_type: { type: 'string' },
            model: { type: 'string' },
            run_in_background: { type: 'boolean' }
          },
          required: ['description', 'prompt', 'subagent_type']
        }
      },
      {
        name: 'AskUserQuestion',
        description: 'Ask the user a structured question.',
        input_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  header: { type: 'string' },
                  options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        description: { type: 'string' }
                      },
                      required: ['label', 'description']
                    }
                  },
                  multiSelect: { type: 'boolean' }
                },
                required: ['question', 'header', 'options']
              }
            }
          },
          required: ['questions']
        }
      },
      {
        name: 'Skill',
        description: 'Load a skill definition.',
        input_schema: {
          type: 'object',
          properties: {
            skill: { type: 'string' },
            args: { type: 'string' }
          },
          required: ['skill']
        }
      }
    ];
    return tools;
  }

  async execute(toolName: ToolName, input: any, context?: ToolExecutionContext): Promise<any> {
    const permission = this.permissionChecker.check(toolName, input ?? {});
    if (permission === 'deny') {
      throw new ToolBlockedError(toolName, 'Permission denied');
    }
    if (permission === 'ask') {
      throw new PermissionRequiredError(toolName, input);
    }

    if (this.hooksManager) {
      const preResult = await this.hooksManager.trigger('PreToolUse', {
        toolName,
        input,
        sessionId: context?.sessionId
      });
      if (preResult.decision === 'block') {
        throw new ToolBlockedError(toolName, preResult.reason);
      }
      if (preResult.modifiedInput) {
        input = preResult.modifiedInput;
      }
    }

    let output: unknown;

    switch (toolName) {
      case 'Bash':
        output = await this.runBash(input as BashInput);
        break;
      case 'Read':
        output = await this.runRead(input as ReadInput);
        break;
      case 'Write':
        output = await this.runWrite(input as WriteInput, context?.sessionId);
        break;
      case 'Edit':
        output = await this.runEdit(input as EditInput, context?.sessionId);
        break;
      case 'Glob':
        output = await this.runGlob(input as GlobInput);
        break;
      case 'Grep':
        output = await this.runGrep(input as GrepInput);
        break;
      case 'WebFetch':
        output = await this.runWebFetch(input as WebFetchInput);
        break;
      case 'TodoWrite':
        output = await this.runTodoWrite(input as TodoWriteInput);
        break;
      case 'Task':
        output = await this.runTask(input as TaskInput);
        break;
      case 'AskUserQuestion':
        output = await this.runAskUserQuestion(input as AskUserQuestionInput);
        break;
      case 'Skill':
        output = await this.runSkill(input as SkillInput);
        break;
      default:
        throw new Error(`Unsupported tool: ${toolName}`);
    }

    if (this.hooksManager) {
      const postResult = await this.hooksManager.trigger('PostToolUse', {
        toolName,
        input,
        output,
        sessionId: context?.sessionId
      });
      if (postResult.modifiedOutput) {
        output = postResult.modifiedOutput;
      }
    }

    return output;
  }

  private async runBash(input: BashInput): Promise<BashOutput> {
    const command = input.command.trim();
    if (this.commandFilter.isDangerous(command)) {
      throw new ToolBlockedError('Bash', 'Command flagged as dangerous');
    }

    if (input.run_in_background) {
      const child = spawn(command, {
        cwd: this.workingDir,
        shell: true,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return { output: 'Command running in background', exitCode: 0, shellId: String(child.pid) };
    }

    const timeout = input.timeout ?? 600000;
    return new Promise((resolve) => {
      exec(
        command,
        { cwd: this.workingDir, timeout, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            this.logger?.error('Bash command failed', { command, error });
          }
          const output = `${stdout}${stderr}`.trim();
          if (error) {
            return resolve({
              output,
              exitCode: (error as any).code ?? 1,
              killed: (error as any).killed
            });
          }
          resolve({ output, exitCode: 0 });
        }
      );
    });
  }

  private async runRead(input: ReadInput): Promise<ReadOutput> {
    const filePath = this.resolvePath(input.file_path);
    if (!this.pathValidator.isPathAllowed(filePath)) {
      throw new ToolBlockedError('Read', 'Path not allowed');
    }
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const offset = input.offset ?? 0;
    const limit = input.limit ?? lines.length;
    const slice = lines.slice(offset, offset + limit);
    const numbered = slice
      .map((line, index) => `${offset + index + 1}: ${line}`)
      .join(os.EOL);

    return {
      content: numbered,
      total_lines: lines.length,
      lines_returned: slice.length
    };
  }

  private async runWrite(input: WriteInput, sessionId?: string): Promise<WriteOutput> {
    const filePath = this.resolvePath(input.file_path);
    if (!this.pathValidator.isPathAllowed(filePath)) {
      throw new ToolBlockedError('Write', 'Path not allowed');
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (this.fileCheckpointer) {
      await this.fileCheckpointer.snapshotIfExists(sessionId, filePath);
    }

    await fs.writeFile(filePath, input.content, 'utf-8');
    return {
      message: 'File written',
      bytes_written: Buffer.byteLength(input.content, 'utf-8')
    };
  }

  private async runEdit(input: EditInput, sessionId?: string): Promise<EditOutput> {
    const filePath = this.resolvePath(input.file_path);
    if (!this.pathValidator.isPathAllowed(filePath)) {
      throw new ToolBlockedError('Edit', 'Path not allowed');
    }

    const content = await fs.readFile(filePath, 'utf-8');
    if (this.fileCheckpointer) {
      await this.fileCheckpointer.snapshotIfExists(sessionId, filePath);
    }

    let replacements = 0;
    let newContent = content;

    if (input.replace_all) {
      const parts = content.split(input.old_string);
      replacements = parts.length - 1;
      newContent = parts.join(input.new_string);
    } else {
      const index = content.indexOf(input.old_string);
      if (index !== -1) {
        replacements = 1;
        newContent = content.replace(input.old_string, input.new_string);
      }
    }

    if (replacements > 0) {
      await fs.writeFile(filePath, newContent, 'utf-8');
    }

    return {
      message: replacements > 0 ? 'File updated' : 'No matches found',
      replacements
    };
  }

  private async runGlob(input: GlobInput): Promise<GlobOutput> {
    const basePath = input.path ? this.resolvePath(input.path) : this.workingDir;
    if (!this.pathValidator.isPathAllowed(basePath)) {
      throw new ToolBlockedError('Glob', 'Path not allowed');
    }

    const files = await this.walkDirectory(basePath);
    const pattern = input.pattern;
    const matcher = this.globToRegExp(pattern);

    const matches = files.filter((file) => {
      const relative = path.relative(basePath, file);
      const normalized = this.normalizePath(relative);
      return matcher.test(normalized);
    });

    return { matches, count: matches.length };
  }

  private async runGrep(input: GrepInput): Promise<GrepOutput> {
    const basePath = input.path ? this.resolvePath(input.path) : this.workingDir;
    if (!this.pathValidator.isPathAllowed(basePath)) {
      throw new ToolBlockedError('Grep', 'Path not allowed');
    }

    const files = input.glob
      ? (await this.runGlob({ pattern: input.glob, path: basePath })).matches
      : await this.walkDirectory(basePath);

    const flags = input['-i'] ? 'i' : '';
    const regex = new RegExp(input.pattern, flags + (input.multiline ? 'm' : ''));
    const matches: GrepOutput['matches'] = [];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split(/\r?\n/);
      let fileHasMatch = false;

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (regex.test(line)) {
          fileHasMatch = true;
          if (input.output_mode === 'files_with_matches') {
            break;
          }

          const beforeCount = input['-C'] ?? input['-B'] ?? 0;
          const afterCount = input['-C'] ?? input['-A'] ?? 0;
          const before = beforeCount > 0 ? lines.slice(Math.max(0, i - beforeCount), i) : [];
          const after = afterCount > 0 ? lines.slice(i + 1, i + 1 + afterCount) : [];

          matches.push({
            file,
            line_number: input['-n'] === false ? undefined : i + 1,
            line,
            before_context: before.length ? before : undefined,
            after_context: after.length ? after : undefined
          });

          if (input.head_limit && matches.length >= input.head_limit) {
            return { matches, total_matches: matches.length };
          }
        }
      }

      if (input.output_mode === 'files_with_matches' && fileHasMatch) {
        matches.push({ file, line: '' });
      }
    }

    if (input.output_mode === 'count') {
      return { matches: [], total_matches: matches.length };
    }

    return { matches, total_matches: matches.length };
  }

  private async runWebFetch(input: WebFetchInput): Promise<WebFetchOutput> {
    const response = await axios.get(input.url, { responseType: 'text' });
    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const trimmed = text.length > 20000 ? text.slice(0, 20000) + '... (truncated)' : text;
    return { content: trimmed, status: response.status };
  }

  private async runTodoWrite(input: TodoWriteInput): Promise<TodoWriteOutput> {
    await fs.mkdir(path.dirname(this.todoPath), { recursive: true });
    await fs.writeFile(this.todoPath, JSON.stringify({ todos: input.todos }, null, 2));

    const stats = input.todos.reduce(
      (acc, todo) => {
        acc.total += 1;
        if (todo.status === 'pending') acc.pending += 1;
        if (todo.status === 'in_progress') acc.in_progress += 1;
        if (todo.status === 'completed') acc.completed += 1;
        return acc;
      },
      { total: 0, pending: 0, in_progress: 0, completed: 0 }
    );

    return { message: 'Todos updated', stats };
  }

  private async runTask(input: TaskInput): Promise<TaskOutput> {
    if (!this.subagentExecutor) {
      throw new Error('Subagent executor not configured');
    }

    const start = Date.now();
    const result = await this.subagentExecutor.runTask(input);
    return {
      result: result.output,
      agent_id: result.agentId,
      duration_ms: Date.now() - start
    };
  }

  private async runAskUserQuestion(input: AskUserQuestionInput): Promise<AskUserQuestionOutput> {
    throw new UserInputRequiredError(input);
  }

  private async runSkill(input: SkillInput): Promise<SkillOutput> {
    if (!this.skillLoader.hasSkill(input.skill)) {
      await this.skillLoader.scanSkills();
    }
    return this.skillLoader.loadSkillContent(input.skill);
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walkDirectory(fullPath)));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private globToRegExp(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '::DOUBLE_STAR::')
      .replace(/\*/g, '[^/]*')
      .replace(/::DOUBLE_STAR::/g, '.*')
      .replace(/\?/g, '[^/]');
    return new RegExp(`^${escaped}$`);
  }

  private normalizePath(value: string): string {
    return value.split(path.sep).join('/');
  }

  private resolvePath(inputPath: string): string {
    return path.isAbsolute(inputPath) ? inputPath : path.join(this.workingDir, inputPath);
  }
}
