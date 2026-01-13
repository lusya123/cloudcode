import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';
import { Config } from '../config';
import { SessionManager, Session } from './session';
import { ToolExecutor } from '../executors/tool-executor';

export class GatewayAgent {
    private anthropic: Anthropic;
    private config: Config;
    private sessionManager: SessionManager;
    private taskScheduler: any; // Using any to avoid circular type ref issues for now, or import properly

    constructor(config: Config, sessionManager: SessionManager, taskScheduler: any) {
        this.config = config;
        this.sessionManager = sessionManager;
        this.taskScheduler = taskScheduler;
        this.anthropic = new Anthropic({
            apiKey: config.claude.apiKey,
            baseURL: config.claude.baseURL,
        });
    }

    private initAnthropic() {
        this.anthropic = new Anthropic({
            apiKey: this.config.claude.apiKey,
            baseURL: this.config.claude.baseURL,
        });
    }

    public updateConfig(newConfig: Config) {
        this.config = newConfig;
        this.initAnthropic();
        logger.info('GatewayAgent config updated');
    }

    /**
     * Process a user message
     */
    async processMessage(sessionId: string, content: string): Promise<{ content: string; newSessionId?: string }> {
        const session = await this.sessionManager.getOrCreateSession('user_default', sessionId); // Default user for now
        this.sessionManager.addMessage(sessionId, 'user', content);

        try {
            // 1. Get History
            const history = this.sessionManager.getHistory(sessionId);

            // 2. Get Executor & Skills
            const executor = this.sessionManager.getExecutor(sessionId);
            if (!executor) throw new Error('Session executor not found');

            const skillsPrompt = executor.getSkillsPrompt();

            // 3. System Prompt
            const systemPrompt = `You are CloudClaude, a 24/7 intelligent cloud assistant.
      
      Current Working Directory: ${session.workingDir}
      
      Capabilities:
      - You can execute Bash commands, read/write files, and more.
      - You can manage scheduled tasks.
      - You act as a pair programmer or system administrator.
      
      ${skillsPrompt}
      
      When using tools, you must output the exact tool call.
      If you need to ask the user a clarifying question, just ask.
      `;

            // 4. Agentic Loop (Max 10 turns)
            let currentTurn = 0;
            const maxTurns = 10;
            let finalReply = '';
            let redirectSessionId: string | undefined;

            // We use a local message history for the loop to append tool results
            // Clone existing history first
            let loopMessages = history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            while (currentTurn < maxTurns) {
                currentTurn++;

                const response = await this.anthropic.messages.create({
                    model: this.config.claude.model,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: loopMessages,
                    tools: [
                        {
                            name: 'Bash',
                            description: 'Execute a bash command',
                            input_schema: {
                                type: 'object',
                                properties: {
                                    command: { type: 'string', description: 'The command to run' },
                                    run_in_background: { type: 'boolean' }
                                },
                                required: ['command']
                            }
                        },
                        {
                            name: 'Read',
                            description: 'Read a file',
                            input_schema: {
                                type: 'object',
                                properties: {
                                    file_path: { type: 'string' }
                                },
                                required: ['file_path']
                            }
                        },
                        {
                            name: 'Write',
                            description: 'Write a file',
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
                            name: 'ScheduleTask',
                            description: 'Schedule a recurring task. Use cron syntax.',
                            input_schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    cron: { type: 'string', description: 'Cron expression e.g. "* * * * *"' },
                                    instruction: { type: 'string', description: 'Task instruction to execute' }
                                },
                                required: ['name', 'cron', 'instruction']
                            }
                        },
                        {
                            name: 'StartNewSession',
                            description: 'Start a new chat session. Use this when the user explicitly asks to start a new chat or conversation.',
                            input_schema: {
                                type: 'object',
                                properties: {},
                                required: []
                            }
                        }
                    ]
                });

                // If text content exists, append it to reply
                const textContent = response.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
                if (textContent) {
                    finalReply = textContent;
                }

                if (response.stop_reason === 'tool_use') {
                    // Append Assistant Clean Message (with tool use)
                    loopMessages.push({ role: 'assistant', content: response.content as any });

                    const toolUses = response.content.filter(c => c.type === 'tool_use');

                    // Parallel Execution (if multiple tools)
                    const toolResults = await Promise.all(toolUses.map(async (toolUse: any) => {
                        let result: any;
                        try {
                            if (toolUse.name === 'ScheduleTask') {
                                logger.info(`Executing tool: ScheduleTask`, toolUse.input);
                                const task = this.taskScheduler.addTask({
                                    name: toolUse.input.name,
                                    cron: toolUse.input.cron,
                                    instruction: toolUse.input.instruction
                                });
                                result = {
                                    status: 'success',
                                    message: `Task scheduled with ID ${task.id}`,
                                    task
                                };
                            } else if (toolUse.name === 'StartNewSession') {
                                logger.info('Executing tool: StartNewSession');
                                const newSession = await this.sessionManager.getOrCreateSession('user_default'); // Create new session
                                result = {
                                    status: 'success',
                                    message: `New session created successfully. ID: ${newSession.id}. Inform the user that a new session has been created.`,
                                    sessionId: newSession.id
                                };
                                redirectSessionId = newSession.id;
                            } else {
                                result = await executor.execute(toolUse.name, toolUse.input);
                            }
                        } catch (e) {
                            result = { error: (e as Error).message };
                        }

                        return {
                            type: 'tool_result',
                            tool_use_id: toolUse.id,
                            content: JSON.stringify(result)
                        };
                    }));

                    // Append Tool Results
                    loopMessages.push({ role: 'user', content: toolResults as any });

                    // Continue loop to let Claude see results and comment
                } else {
                    // Stop Reason is end_turn (or max_tokens)
                    // If we have a final text, we are done.
                    // Push the final assistant message to Real History
                    this.sessionManager.addMessage(sessionId, 'assistant', finalReply);
                    return { content: finalReply, newSessionId: redirectSessionId };
                }
            }

            return { content: finalReply || "Agent loop limit reached.", newSessionId: redirectSessionId };

        } catch (error) {
            logger.error('Error in GatewayAgent:', error);
            return { content: `Error: ${(error as Error).message}` };
        }
    }
}
