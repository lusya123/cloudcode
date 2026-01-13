/**
 * Agentic Loop for CloudClaude
 * Core execution loop that calls Claude API and executes tool calls
 */

import Anthropic from '@anthropic-ai/sdk';
import { ToolExecutor } from '../executors/tool-executor';
import { HooksManager } from './hooks-manager';
import { Logger } from '../utils/logger';
import { ClaudeMdLoader } from '../utils/claude-md-loader';

const logger = new Logger('AgenticLoop');

// Tool definitions for Claude API
const TOOL_DEFINITIONS: Anthropic.Tool[] = [
    {
        name: 'Bash',
        description: 'Execute a shell command. Use for running scripts, system commands, package management, etc.',
        input_schema: {
            type: 'object' as const,
            properties: {
                command: { type: 'string', description: 'The shell command to execute' },
                timeout: { type: 'number', description: 'Timeout in milliseconds (max 600000)' },
                description: { type: 'string', description: 'Description of what the command does' }
            },
            required: ['command']
        }
    },
    {
        name: 'Read',
        description: 'Read the contents of a file. Returns content with line numbers.',
        input_schema: {
            type: 'object' as const,
            properties: {
                file_path: { type: 'string', description: 'Absolute or relative file path' },
                offset: { type: 'number', description: 'Starting line number (0-indexed)' },
                limit: { type: 'number', description: 'Maximum lines to read (default 2000)' }
            },
            required: ['file_path']
        }
    },
    {
        name: 'Write',
        description: 'Write content to a file. Creates directories if needed.',
        input_schema: {
            type: 'object' as const,
            properties: {
                file_path: { type: 'string', description: 'Absolute or relative file path' },
                content: { type: 'string', description: 'Content to write' }
            },
            required: ['file_path', 'content']
        }
    },
    {
        name: 'Edit',
        description: 'Edit a file by replacing text. Use for precise modifications.',
        input_schema: {
            type: 'object' as const,
            properties: {
                file_path: { type: 'string', description: 'Absolute or relative file path' },
                old_string: { type: 'string', description: 'Text to find and replace' },
                new_string: { type: 'string', description: 'Replacement text' },
                replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' }
            },
            required: ['file_path', 'old_string', 'new_string']
        }
    },
    {
        name: 'Glob',
        description: 'Find files matching a glob pattern.',
        input_schema: {
            type: 'object' as const,
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
                path: { type: 'string', description: 'Base directory for search' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'Grep',
        description: 'Search for content in files using regex pattern.',
        input_schema: {
            type: 'object' as const,
            properties: {
                pattern: { type: 'string', description: 'Regex pattern to search' },
                path: { type: 'string', description: 'Directory to search' },
                glob: { type: 'string', description: 'File filter pattern' },
                '-i': { type: 'boolean', description: 'Case insensitive' },
                '-n': { type: 'boolean', description: 'Show line numbers' },
                head_limit: { type: 'number', description: 'Limit results' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'WebFetch',
        description: 'Fetch a webpage and convert to Markdown.',
        input_schema: {
            type: 'object' as const,
            properties: {
                url: { type: 'string', description: 'URL to fetch' },
                prompt: { type: 'string', description: 'Instructions for processing' }
            },
            required: ['url', 'prompt']
        }
    },
    {
        name: 'Skill',
        description: 'Load a skill for guidance on specific tasks. Use when user requests /skill-name or task matches a skill.',
        input_schema: {
            type: 'object' as const,
            properties: {
                skill: { type: 'string', description: 'Skill name to load' },
                args: { type: 'string', description: 'Optional arguments' }
            },
            required: ['skill']
        }
    },
    {
        name: 'ConfigureAI',
        description: 'Configure the AI API settings. Use this to update the API key, base URL, or default model. The Agent can use this to reconfigure itself.',
        input_schema: {
            type: 'object' as const,
            properties: {
                api_key: { type: 'string', description: 'New API key to use' },
                base_url: { type: 'string', description: 'Custom API base URL (for proxies or alternative endpoints)' },
                model: { type: 'string', description: 'Default model to use (e.g., claude-sonnet-4-20250514)' }
            },
            required: []
        }
    }
];

interface AgenticLoopOptions {
    workingDir: string;
    maxTurns?: number;
    systemPrompt?: string;
    tools?: Anthropic.Tool[];
    hooks?: HooksManager;
    model?: string;
    apiKey?: string;     // Dynamic API key
    baseUrl?: string;    // Custom API endpoint
}

interface Message {
    role: 'user' | 'assistant';
    content: any;
}

export class AgenticLoop {
    private client: Anthropic;
    private executor: ToolExecutor;
    private options: AgenticLoopOptions;
    private messages: Message[] = [];
    private hooks?: HooksManager;
    private claudeMdLoader: ClaudeMdLoader;
    private model: string;

    constructor(options: AgenticLoopOptions) {
        // Create Anthropic client with optional custom baseUrl and apiKey
        const clientOptions: { apiKey?: string; baseURL?: string } = {};
        if (options.apiKey) clientOptions.apiKey = options.apiKey;
        if (options.baseUrl) clientOptions.baseURL = options.baseUrl;

        this.client = new Anthropic(clientOptions);
        this.executor = new ToolExecutor(options.workingDir);
        this.options = options;
        this.hooks = options.hooks;
        this.claudeMdLoader = new ClaudeMdLoader();
        this.model = options.model || 'claude-sonnet-4-20250514';
    }

    /**
     * Initialize the agentic loop
     */
    async init(): Promise<void> {
        await this.executor.init();
        logger.info('AgenticLoop initialized');
    }

    /**
     * Run the agentic loop with a user message
     */
    async run(userMessage: string): Promise<string> {
        // Add user message
        this.messages.push({
            role: 'user',
            content: userMessage
        });

        let turns = 0;
        const maxTurns = this.options.maxTurns || 100;

        while (turns < maxTurns) {
            turns++;
            logger.info(`Turn ${turns}/${maxTurns}`);

            // Build system prompt
            const systemPrompt = await this.buildSystemPrompt();

            // Call Claude API
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 8192,
                system: systemPrompt,
                tools: this.options.tools || TOOL_DEFINITIONS,
                messages: this.messages
            });

            // Check for tool calls
            const toolUseBlocks = response.content.filter(
                block => block.type === 'tool_use'
            ) as Anthropic.ToolUseBlock[];

            // Save assistant response
            this.messages.push({
                role: 'assistant',
                content: response.content
            });

            // If no tool calls, return text result
            if (toolUseBlocks.length === 0) {
                const textBlocks = response.content.filter(
                    block => block.type === 'text'
                ) as Anthropic.TextBlock[];
                return textBlocks.map(b => b.text).join('\n');
            }

            // Execute all tool calls
            const toolResults = await this.executeTools(toolUseBlocks);

            // Add tool results to message history
            this.messages.push({
                role: 'user',
                content: toolResults
            });

            // Check if should stop
            if (response.stop_reason === 'end_turn') {
                const textBlocks = response.content.filter(
                    block => block.type === 'text'
                ) as Anthropic.TextBlock[];
                if (textBlocks.length > 0) {
                    return textBlocks.map(b => b.text).join('\n');
                }
            }
        }

        throw new Error(`Exceeded maximum turns (${maxTurns})`);
    }

    /**
     * Execute tool calls
     */
    private async executeTools(toolUseBlocks: Anthropic.ToolUseBlock[]): Promise<any[]> {
        const results = [];

        for (const block of toolUseBlocks) {
            const { id, name, input } = block;

            logger.info(`Executing tool: ${name}`, { input });

            try {
                // PreToolUse Hook
                if (this.hooks) {
                    const hookResult = await this.hooks.trigger('PreToolUse', {
                        toolName: name,
                        input,
                        toolUseId: id
                    });

                    if (hookResult.decision === 'block') {
                        results.push({
                            type: 'tool_result',
                            tool_use_id: id,
                            content: `Tool blocked: ${hookResult.reason || 'Blocked by hook'}`,
                            is_error: true
                        });
                        continue;
                    }
                }

                // Execute tool
                const output = await this.executor.execute(name, input);

                // PostToolUse Hook
                if (this.hooks) {
                    await this.hooks.trigger('PostToolUse', {
                        toolName: name,
                        input,
                        output,
                        toolUseId: id
                    });
                }

                results.push({
                    type: 'tool_result',
                    tool_use_id: id,
                    content: typeof output === 'string' ? output : JSON.stringify(output, null, 2)
                });

            } catch (error: any) {
                logger.error(`Tool execution failed: ${name}`, error);

                results.push({
                    type: 'tool_result',
                    tool_use_id: id,
                    content: `Error: ${error.message}`,
                    is_error: true
                });
            }
        }

        return results;
    }

    /**
     * Build system prompt with skills and CLAUDE.md
     */
    private async buildSystemPrompt(): Promise<string> {
        let prompt = this.options.systemPrompt || this.getDefaultSystemPrompt();

        // Add CLAUDE.md content
        const claudeMd = await this.claudeMdLoader.load(this.options.workingDir);
        if (claudeMd) {
            prompt += '\n\n---\n\n# Project Context\n\n' + claudeMd;
        }

        // Add available skills
        const skillsPrompt = this.executor.getSkillsPrompt();
        if (skillsPrompt) {
            prompt += '\n' + skillsPrompt;
        }

        return prompt;
    }

    /**
     * Get default system prompt
     */
    private getDefaultSystemPrompt(): string {
        return `You are CloudClaude, an AI assistant running on a cloud server.
You have access to tools that allow you to execute commands, read/write files, and search content.
Your working directory is: ${this.options.workingDir}

Always use tools to accomplish tasks. Be careful with destructive operations.
When executing bash commands, prefer to show the output to the user.
Respond in the same language as the user.`;
    }

    /**
     * Get message history
     */
    getMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * Set message history (for restoring sessions)
     */
    setMessages(messages: Message[]): void {
        this.messages = [...messages];
    }

    /**
     * Clear message history
     */
    clearMessages(): void {
        this.messages = [];
    }

    /**
     * Get tool executor
     */
    getExecutor(): ToolExecutor {
        return this.executor;
    }
}

// Export tool definitions for reuse
export { TOOL_DEFINITIONS };
