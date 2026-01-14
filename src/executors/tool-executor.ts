import { exec, spawn } from 'child_process';
import * as fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import axios from 'axios';
import TurndownService from 'turndown';
import type {
  AskUserQuestionInput,
  AskUserQuestionOutput,
  BashInput,
  BashOutput,
  EditInput,
  EditOutput,
  GlobInput,
  GlobOutput,
  GrepInput,
  GrepOutput,
  ReadInput,
  ReadOutput,
  TaskInput,
  TaskOutput,
  TodoWriteInput,
  TodoWriteOutput,
  WebFetchInput,
  WebFetchOutput,
  WriteInput,
  WriteOutput
} from '../types/tools';
import { CommandFilter } from '../security/command-filter';
import { PermissionChecker } from '../security/permission-checker';
import { PathValidator } from '../security/path-validator';
import type { McpClient } from '../mcp/mcp-client';
import type { SubagentExecutor } from '../agents/subagent-executor';

const execAsync = promisify(exec);

export class ToolExecutor {
  private workingDir: string;
  private bashSessions: Map<string, any> = new Map();
  private permissionChecker?: PermissionChecker;
  private commandFilter?: CommandFilter;
  private pathValidator: PathValidator;
  private mcpClient?: McpClient;
  private subagentExecutor?: SubagentExecutor;

  constructor(
    workingDir: string,
    options: {
      permissionChecker?: PermissionChecker;
      commandFilter?: CommandFilter;
      allowedPaths?: string[];
      mcpClient?: McpClient;
      subagentExecutor?: SubagentExecutor;
    } = {}
  ) {
    this.workingDir = workingDir;
    this.permissionChecker = options.permissionChecker;
    this.commandFilter = options.commandFilter;
    this.pathValidator = new PathValidator(workingDir, options.allowedPaths || []);
    this.mcpClient = options.mcpClient;
    this.subagentExecutor = options.subagentExecutor;
  }

  async execute(toolName: string, input: any): Promise<any> {
    if (toolName.startsWith('mcp__')) {
      if (!this.mcpClient) {
        throw new Error('MCP client not configured');
      }
      return this.mcpClient.callTool(toolName, input);
    }

    const decision = this.permissionChecker?.check(toolName, input) || 'allow';
    if (decision === 'deny') {
      throw new Error(`Permission denied for ${toolName}`);
    }
    if (decision === 'ask') {
      throw new Error(`Permission requires confirmation for ${toolName}`);
    }

    switch (toolName) {
      case 'Bash':
        return this.executeBash(input as BashInput);
      case 'Read':
        return this.executeRead(input as ReadInput);
      case 'Write':
        return this.executeWrite(input as WriteInput);
      case 'Edit':
        return this.executeEdit(input as EditInput);
      case 'Glob':
        return this.executeGlob(input as GlobInput);
      case 'Grep':
        return this.executeGrep(input as GrepInput);
      case 'WebFetch':
        return this.executeWebFetch(input as WebFetchInput);
      case 'TodoWrite':
        return this.executeTodoWrite(input as TodoWriteInput);
      case 'Task':
        return this.executeTask(input as TaskInput);
      case 'AskUserQuestion':
        return this.executeAskUserQuestion(input as AskUserQuestionInput);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async executeBash(input: BashInput): Promise<BashOutput> {
    const timeout = input.timeout || 120000;
    const command = input.command;

    const safe = this.commandFilter?.isSafe(command) || { safe: true };
    if (!safe.safe) {
      throw new Error(safe.reason || 'Command blocked by filter');
    }

    if (input.run_in_background) {
      const child = spawn(command, {
        cwd: this.workingDir,
        env: { ...process.env, PATH: process.env.PATH },
        shell: true,
        detached: true,
        stdio: 'ignore'
      });
      const shellId = `shell_${Date.now()}`;
      this.bashSessions.set(shellId, child);
      child.unref();
      return {
        output: `Command running in background with id ${shellId}`,
        exitCode: 0,
        shellId
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PATH: process.env.PATH }
      });

      return {
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        exitCode: 0
      };
    } catch (error: any) {
      return {
        output: `${error.stdout || ''}\n${error.stderr || error.message}`,
        exitCode: error.code || 1,
        killed: error.killed
      };
    }
  }

  private resolvePath(filePath: string): string {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workingDir, filePath);
    if (!this.pathValidator.isAllowed(resolved)) {
      throw new Error(`Path not allowed: ${resolved}`);
    }
    return resolved;
  }

  private async executeRead(input: ReadInput): Promise<ReadOutput> {
    const filePath = this.resolvePath(input.file_path);

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const offset = input.offset || 0;
    const limit = input.limit || 2000;
    const selectedLines = lines.slice(offset, offset + limit);

    const numberedContent = selectedLines
      .map((line, i) => `${String(offset + i + 1).padStart(6)}\t${line}`)
      .join('\n');

    return {
      content: numberedContent,
      total_lines: lines.length,
      lines_returned: selectedLines.length
    };
  }

  private async executeWrite(input: WriteInput): Promise<WriteOutput> {
    const filePath = this.resolvePath(input.file_path);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.content, 'utf-8');

    return {
      message: `Successfully wrote to ${filePath}`,
      bytes_written: Buffer.byteLength(input.content, 'utf-8')
    };
  }

  private async executeEdit(input: EditInput): Promise<EditOutput> {
    const filePath = this.resolvePath(input.file_path);

    let content = await fs.readFile(filePath, 'utf-8');

    let replacements = 0;
    if (input.replace_all) {
      const regex = new RegExp(this.escapeRegex(input.old_string), 'g');
      const matches = content.match(regex);
      replacements = matches ? matches.length : 0;
      content = content.replace(regex, input.new_string);
    } else {
      if (content.includes(input.old_string)) {
        content = content.replace(input.old_string, input.new_string);
        replacements = 1;
      }
    }

    if (replacements === 0) {
      throw new Error(`old_string not found in file: ${input.old_string.substring(0, 50)}...`);
    }

    await fs.writeFile(filePath, content, 'utf-8');

    return {
      message: `Successfully edited ${filePath}`,
      replacements
    };
  }

  private async executeGlob(input: GlobInput): Promise<GlobOutput> {
    const searchPath = input.path || this.workingDir;
    const matches = await glob(input.pattern, {
      cwd: searchPath,
      absolute: true,
      nodir: true
    });

    return {
      matches: matches.sort(),
      count: matches.length
    };
  }

  private async executeGrep(input: GrepInput): Promise<GrepOutput> {
    const args = ['--json'];

    if (input['-i']) args.push('-i');
    if (input['-n']) args.push('-n');
    if (input['-B']) args.push('-B', String(input['-B']));
    if (input['-A']) args.push('-A', String(input['-A']));
    if (input['-C']) args.push('-C', String(input['-C']));
    if (input.glob) args.push('--glob', input.glob);
    if (input.multiline) args.push('-U', '--multiline-dotall');

    args.push(input.pattern);
    args.push(input.path || this.workingDir);

    try {
      const { stdout } = await execAsync(`rg ${args.join(' ')}`, {
        cwd: this.workingDir,
        maxBuffer: 10 * 1024 * 1024
      });

      const matches = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .filter(item => item.type === 'match')
        .map(item => ({
          file: item.data.path.text,
          line_number: item.data.line_number,
          line: item.data.lines.text.trim()
        }));

      return {
        matches: input.head_limit ? matches.slice(0, input.head_limit) : matches,
        total_matches: matches.length
      };
    } catch {
      return this.executeGrepFallback(input);
    }
  }

  private async executeGrepFallback(input: GrepInput): Promise<GrepOutput> {
    const args: string[] = [];
    if (input['-i']) args.push('-i');
    if (input['-n']) args.push('-n');
    if (input['-B']) args.push('-B', String(input['-B']));
    if (input['-A']) args.push('-A', String(input['-A']));
    if (input['-C']) args.push('-C', String(input['-C']));

    args.push('-R');
    args.push(input.pattern);
    args.push(input.path || this.workingDir);

    try {
      const { stdout } = await execAsync(`grep ${args.join(' ')}`, {
        cwd: this.workingDir,
        maxBuffer: 10 * 1024 * 1024
      });

      const matches = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [file, lineNumber, ...rest] = line.split(':');
          return {
            file,
            line_number: lineNumber ? Number(lineNumber) : undefined,
            line: rest.join(':')
          };
        });

      return {
        matches: input.head_limit ? matches.slice(0, input.head_limit) : matches,
        total_matches: matches.length
      };
    } catch {
      return { matches: [], total_matches: 0 };
    }
  }

  private async executeWebFetch(input: WebFetchInput): Promise<WebFetchOutput> {
    const response = await axios.get(input.url, {
      timeout: 30000,
      headers: { 'User-Agent': 'CloudClaude/1.0' }
    });

    const turndown = new TurndownService();
    const markdown = turndown.turndown(response.data);

    return {
      content: markdown.substring(0, 50000),
      status: response.status
    };
  }

  private async executeTodoWrite(input: TodoWriteInput): Promise<TodoWriteOutput> {
    const stats = {
      total: input.todos.length,
      pending: input.todos.filter(t => t.status === 'pending').length,
      in_progress: input.todos.filter(t => t.status === 'in_progress').length,
      completed: input.todos.filter(t => t.status === 'completed').length
    };

    return {
      message: 'Todos updated successfully',
      stats
    };
  }

  private async executeTask(input: TaskInput): Promise<TaskOutput> {
    if (!this.subagentExecutor) {
      throw new Error('Subagent executor not configured');
    }
    const startedAt = Date.now();
    const result = await this.subagentExecutor.execute(
      input.subagent_type,
      input.prompt,
      this.workingDir
    );

    return {
      result: result.result,
      agent_id: result.agentId,
      duration_ms: Date.now() - startedAt
    };
  }

  private async executeAskUserQuestion(_input: AskUserQuestionInput): Promise<AskUserQuestionOutput> {
    return { answers: {} };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
