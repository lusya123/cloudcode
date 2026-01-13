/**
 * Tool Executor for CloudClaude
 * Implements all agent tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, TodoWrite, Skill
 */

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import { SkillLoader } from '../skills/skill-loader';
import { CommandFilter } from '../security/command-filter';
import { PathValidator } from '../security/path-validator';
import { Logger } from '../utils/logger';
import { updateAnthropicConfig } from '../utils/config-loader';
import {
    BashInput, BashOutput,
    ReadInput, ReadOutput,
    WriteInput, WriteOutput,
    EditInput, EditOutput,
    GlobInput, GlobOutput,
    GrepInput, GrepOutput,
    WebFetchInput, WebFetchOutput,
    TodoWriteInput, TodoWriteOutput,
    SkillInput, SkillOutput
} from '../types/tools';

const execAsync = promisify(exec);
const logger = new Logger('ToolExecutor');

export class ToolExecutor {
    private workingDir: string;
    private skillLoader: SkillLoader;
    private commandFilter: CommandFilter;
    private pathValidator: PathValidator;

    constructor(
        workingDir: string,
        homeDir: string = process.env.HOME || '~',
        allowedPaths: string[] = []
    ) {
        this.workingDir = path.resolve(workingDir);
        this.skillLoader = new SkillLoader(homeDir, workingDir);
        this.commandFilter = new CommandFilter();
        this.pathValidator = new PathValidator(workingDir, allowedPaths);
    }

    /**
     * Initialize tool executor (scan skills)
     */
    async init(): Promise<void> {
        await this.skillLoader.scanSkills();
        logger.info(`ToolExecutor initialized with working dir: ${this.workingDir}`);
    }

    /**
     * Get skills prompt for System Prompt injection
     */
    getSkillsPrompt(): string {
        return this.skillLoader.generateSkillsPrompt();
    }

    /**
     * Execute a tool call
     */
    async execute(toolName: string, input: any): Promise<any> {
        logger.debug(`Executing tool: ${toolName}`, { input });

        switch (toolName) {
            case 'Bash':
                return this.executeBash(input);
            case 'Read':
                return this.executeRead(input);
            case 'Write':
                return this.executeWrite(input);
            case 'Edit':
                return this.executeEdit(input);
            case 'Glob':
                return this.executeGlob(input);
            case 'Grep':
                return this.executeGrep(input);
            case 'WebFetch':
                return this.executeWebFetch(input);
            case 'TodoWrite':
                return this.executeTodoWrite(input);
            case 'Skill':
                return this.executeSkill(input);
            case 'ConfigureAI':
                return this.executeConfigureAI(input);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    /**
     * Bash command execution
     */
    private async executeBash(input: BashInput): Promise<BashOutput> {
        const timeout = input.timeout || 120000; // Default 2 minutes

        // Security check
        const safetyCheck = this.commandFilter.isSafe(input.command);
        if (!safetyCheck.safe) {
            return {
                output: `Command blocked: ${safetyCheck.reason}`,
                exitCode: 1
            };
        }

        try {
            const { stdout, stderr } = await execAsync(input.command, {
                cwd: this.workingDir,
                timeout,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                env: { ...process.env, PATH: process.env.PATH }
            });

            return {
                output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
                exitCode: 0
            };
        } catch (error: any) {
            return {
                output: (error.stdout || '') + '\n' + (error.stderr || error.message),
                exitCode: error.code || 1,
                killed: error.killed
            };
        }
    }

    /**
     * Read file content
     */
    private async executeRead(input: ReadInput): Promise<ReadOutput> {
        const filePath = this.pathValidator.resolvePath(input.file_path);
        this.pathValidator.validate(filePath);

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        const offset = input.offset || 0;
        const limit = input.limit || 2000;
        const selectedLines = lines.slice(offset, offset + limit);

        // Add line numbers (like cat -n)
        const numberedContent = selectedLines
            .map((line, i) => `${String(offset + i + 1).padStart(6)}\t${line}`)
            .join('\n');

        return {
            content: numberedContent,
            total_lines: lines.length,
            lines_returned: selectedLines.length
        };
    }

    /**
     * Write file content
     */
    private async executeWrite(input: WriteInput): Promise<WriteOutput> {
        const filePath = this.pathValidator.resolvePath(input.file_path);
        this.pathValidator.validate(filePath);

        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content, 'utf-8');

        return {
            message: `Successfully wrote to ${filePath}`,
            bytes_written: Buffer.byteLength(input.content, 'utf-8')
        };
    }

    /**
     * Edit file (find and replace)
     */
    private async executeEdit(input: EditInput): Promise<EditOutput> {
        const filePath = this.pathValidator.resolvePath(input.file_path);
        this.pathValidator.validate(filePath);

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

    /**
     * Glob file pattern matching
     */
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

    /**
     * Grep content search (using ripgrep if available, fallback to basic search)
     */
    private async executeGrep(input: GrepInput): Promise<GrepOutput> {
        const searchPath = input.path || this.workingDir;

        try {
            // Try using ripgrep
            const args = ['--json'];
            if (input['-i']) args.push('-i');
            if (input['-n']) args.push('-n');
            if (input['-B']) args.push('-B', String(input['-B']));
            if (input['-A']) args.push('-A', String(input['-A']));
            if (input['-C']) args.push('-C', String(input['-C']));
            if (input.glob) args.push('--glob', input.glob);
            if (input.multiline) args.push('-U', '--multiline-dotall');

            args.push(input.pattern);
            args.push(searchPath);

            const { stdout } = await execAsync(`rg ${args.join(' ')}`, {
                cwd: this.workingDir,
                maxBuffer: 10 * 1024 * 1024
            });

            // Parse ripgrep JSON output
            const matches = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(item => item && item.type === 'match')
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
            // Fallback to basic grep
            try {
                const { stdout } = await execAsync(
                    `grep -rn "${input.pattern}" "${searchPath}"`,
                    { cwd: this.workingDir, maxBuffer: 10 * 1024 * 1024 }
                );

                const matches = stdout.split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const match = line.match(/^(.+):(\d+):(.*)$/);
                        if (match) {
                            return {
                                file: match[1],
                                line_number: parseInt(match[2], 10),
                                line: match[3]
                            };
                        }
                        return null;
                    })
                    .filter(Boolean) as any[];

                return {
                    matches: input.head_limit ? matches.slice(0, input.head_limit) : matches,
                    total_matches: matches.length
                };
            } catch {
                return { matches: [], total_matches: 0 };
            }
        }
    }

    /**
     * WebFetch - fetch and convert webpage to markdown
     */
    private async executeWebFetch(input: WebFetchInput): Promise<WebFetchOutput> {
        const axios = (await import('axios')).default;
        const TurndownService = (await import('turndown')).default;

        try {
            const response = await axios.get(input.url, {
                timeout: 30000,
                headers: { 'User-Agent': 'CloudClaude/1.0' }
            });

            // Convert HTML to Markdown
            const turndown = new TurndownService();
            const markdown = turndown.turndown(response.data);

            return {
                content: markdown.substring(0, 50000), // Limit length
                status: response.status
            };
        } catch (error: any) {
            return {
                content: `Error fetching URL: ${error.message}`,
                status: error.response?.status || 0
            };
        }
    }

    /**
     * TodoWrite - task management
     */
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

    /**
     * Skill - load and return skill content
     */
    private async executeSkill(input: SkillInput): Promise<SkillOutput> {
        const skillName = input.skill;

        if (!this.skillLoader.hasSkill(skillName)) {
            const available = this.skillLoader.getAvailableSkills().map(s => s.name).join(', ');
            throw new Error(`Skill not found: ${skillName}. Available: ${available}`);
        }

        const skillContent = await this.skillLoader.loadSkillContent(skillName);

        return {
            name: skillContent.name,
            description: skillContent.description,
            content: skillContent.content,
            source: skillContent.source,
            path: skillContent.path
        };
    }

    /**
     * Escape regex special characters
     */
    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Update working directory
     */
    setWorkingDir(newWorkingDir: string): void {
        this.workingDir = path.resolve(newWorkingDir);
        this.pathValidator.setWorkingDir(newWorkingDir);
    }

    /**
     * Get working directory
     */
    getWorkingDir(): string {
        return this.workingDir;
    }

    /**
     * Configure AI - update API settings dynamically
     */
    private async executeConfigureAI(input: {
        api_key?: string;
        base_url?: string;
        model?: string;
    }): Promise<{ message: string; configured: string[] }> {
        const configured: string[] = [];

        // Update configuration file
        await updateAnthropicConfig({
            apiKey: input.api_key,
            baseUrl: input.base_url,
            model: input.model
        });

        if (input.api_key) configured.push('API Key');
        if (input.base_url) configured.push(`Base URL: ${input.base_url}`);
        if (input.model) configured.push(`Model: ${input.model}`);

        logger.info('AI configuration updated', { configured });

        return {
            message: 'AI configuration updated successfully. Changes will take effect for new sessions.',
            configured
        };
    }
}
