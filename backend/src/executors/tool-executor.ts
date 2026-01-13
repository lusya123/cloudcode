import { exec, spawn } from 'child_process';
import * as fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import axios from 'axios';
import logger from '../utils/logger';
import { SkillLoader } from '../skills/skill-loader';
import * as Tools from '../types/tools';
import * as readline from 'readline';

const execAsync = promisify(exec);

export class ToolExecutor {
    private workingDir: string;
    private skillLoader: SkillLoader;

    constructor(workingDir: string, homeDir: string = process.env.HOME || '~') {
        this.workingDir = workingDir;
        this.skillLoader = new SkillLoader(homeDir, workingDir);
    }

    /**
     * Initialize resources (scan skills)
     */
    async init(): Promise<void> {
        await this.skillLoader.scanSkills();
    }

    /**
     * Get Skills Prompt
     */
    getSkillsPrompt(): string {
        return this.skillLoader.generateSkillsPrompt();
    }

    /**
     * Execute a tool
     */
    async execute(toolName: string, input: any): Promise<any> {
        logger.info(`Executing tool: ${toolName}`, { input });
        try {
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
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            logger.error(`Error executing tool ${toolName}:`, error);
            throw error;
        }
    }

    /**
     * Bash Execution
     */
    private async executeBash(input: Tools.BashInput): Promise<Tools.BashOutput> {
        const timeout = input.timeout || 120000; // 2 minutes default

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
     * Read File
     */
    private async executeRead(input: Tools.ReadInput): Promise<Tools.ReadOutput> {
        const filePath = path.isAbsolute(input.file_path)
            ? input.file_path
            : path.resolve(this.workingDir, input.file_path);

        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const total_lines = lines.length;

        let start = 0;
        let end = total_lines;

        if (input.offset) start = Math.max(0, input.offset - 1);
        if (input.limit) end = Math.min(total_lines, start + input.limit);

        const resultLines = lines.slice(start, end).map((line, idx) => `${start + idx + 1}: ${line}`);

        return {
            content: resultLines.join('\n'),
            total_lines,
            lines_returned: resultLines.length
        };
    }

    /**
     * Write File
     */
    private async executeWrite(input: Tools.WriteInput): Promise<Tools.WriteOutput> {
        const filePath = path.isAbsolute(input.file_path)
            ? input.file_path
            : path.resolve(this.workingDir, input.file_path);

        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        await fs.writeFile(filePath, input.content, 'utf-8');

        return {
            message: `Successfully wrote to ${filePath}`,
            bytes_written: Buffer.from(input.content).length
        };
    }

    /**
     * Edit File
     */
    private async executeEdit(input: Tools.EditInput): Promise<Tools.EditOutput> {
        const filePath = path.isAbsolute(input.file_path)
            ? input.file_path
            : path.resolve(this.workingDir, input.file_path);

        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        let content = await fs.readFile(filePath, 'utf-8');
        const oldString = input.old_string;
        const newString = input.new_string;

        // Count occurrences
        const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), input.replace_all ? 'g' : '');
        const matches = content.match(regex);
        const count = matches ? matches.length : 0;

        if (count === 0) {
            throw new Error('Target string not found in file');
        }

        content = content.replace(regex, newString);
        await fs.writeFile(filePath, content, 'utf-8');

        return {
            message: `Successfully replaced ${count} occurrence(s)`,
            replacements: count
        };
    }

    /**
     * Glob Search
     */
    private async executeGlob(input: Tools.GlobInput): Promise<Tools.GlobOutput> {
        const searchPath = input.path
            ? (path.isAbsolute(input.path) ? input.path : path.resolve(this.workingDir, input.path))
            : this.workingDir;

        const files = await glob(input.pattern, { cwd: searchPath });

        return {
            matches: files,
            count: files.length
        };
    }

    /**
     * Grep Search
     * Note: This is a simplified Node.js implementation
     */
    private async executeGrep(input: Tools.GrepInput): Promise<Tools.GrepOutput> {
        const searchPath = input.path
            ? (path.isAbsolute(input.path) ? input.path : path.resolve(this.workingDir, input.path))
            : this.workingDir;

        // Use git grep or grep command actually, for performance
        const flags = [];
        if (input['-i']) flags.push('-i');
        if (input['-n']) flags.push('-n');
        if (input['-B']) flags.push(`-B ${input['-B']}`);
        if (input['-A']) flags.push(`-A ${input['-A']}`);
        if (input['-C']) flags.push(`-C ${input['-C']}`);

        // Construct command
        // Use grep -r for directory or normal grep for file
        const isDir = (await fs.stat(searchPath)).isDirectory();
        const cmd = `grep ${flags.join(' ')} ${isDir ? '-r' : ''} "${input.pattern}" "${searchPath}"`;

        try {
            const { stdout } = await execAsync(cmd, { cwd: searchPath });
            const lines = stdout.trim().split('\n');

            const matches = lines.map(line => {
                // Basic parsing, depends on grep output format
                // Example: file:line:content
                const parts = line.split(':');
                return {
                    file: parts[0],
                    line: line, // Return full line for now
                    line_number: parseInt(parts[1]) || undefined
                };
            });

            return {
                matches,
                total_matches: matches.length
            };

        } catch (e: any) {
            if (e.code === 1) {
                return { matches: [], total_matches: 0 }; // No matches
            }
            throw e;
        }
    }

    /**
     * Web Fetch
     */
    private async executeWebFetch(input: Tools.WebFetchInput): Promise<Tools.WebFetchOutput> {
        const response = await axios.get(input.url);
        // In real implementation, we would use a library to convert HTML to Markdown (e.g. turndown)
        // For now, return raw data or simplified content
        return {
            content: typeof response.data === 'string' ? response.data.substring(0, 10000) : JSON.stringify(response.data),
            status: response.status
        };
    }

    /**
     * Todo Write (Stub)
     */
    private async executeTodoWrite(input: Tools.TodoWriteInput): Promise<Tools.TodoWriteOutput> {
        // This would typically update a TODO.md file
        return {
            message: 'Todos updated',
            stats: {
                total: input.todos.length,
                pending: input.todos.filter(t => t.status === 'pending').length,
                in_progress: input.todos.filter(t => t.status === 'in_progress').length,
                completed: input.todos.filter(t => t.status === 'completed').length
            }
        };
    }

    /**
     * Skill Execution
     */
    private async executeSkill(input: Tools.SkillInput): Promise<Tools.SkillOutput> {
        return await this.skillLoader.loadSkillContent(input.skill);
    }
}
