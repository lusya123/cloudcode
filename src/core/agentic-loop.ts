import Anthropic from '@anthropic-ai/sdk';
import type { ToolName } from '../types/tools';
import { PermissionRequiredError, ToolBlockedError, UserInputRequiredError } from '../errors';
import type { HooksManager } from './hooks-manager';
import type { ToolExecutor } from '../executors/tool-executor';

export interface AgentLoopOptions {
  model?: string;
  maxTokens?: number;
  maxSteps?: number;
  systemPrompt?: string;
  hooks?: HooksManager;
}

export interface AgentLoopInput {
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  sessionId?: string;
}

export interface AgentLoopResult {
  reply: string;
  stoppedBy?: 'tool_limit' | 'permission' | 'user_input';
}

export class AgenticLoop {
  private client: Anthropic;
  private toolExecutor: ToolExecutor;
  private options: {
    model: string;
    maxTokens: number;
    maxSteps: number;
    systemPrompt: string;
    hooks?: HooksManager;
  };

  constructor(client: Anthropic, toolExecutor: ToolExecutor, options?: AgentLoopOptions) {
    this.client = client;
    this.toolExecutor = toolExecutor;
    this.options = {
      model: options?.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
      maxTokens: options?.maxTokens ?? 1024,
      maxSteps: options?.maxSteps ?? 8,
      systemPrompt: options?.systemPrompt ?? '',
      hooks: options?.hooks
    };
  }

  async run(input: AgentLoopInput): Promise<AgentLoopResult> {
    const messages = [...input.messages];

    for (let step = 0; step < this.options.maxSteps; step += 1) {
      const response = await this.client.messages.create({
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        system: this.options.systemPrompt || undefined,
        messages,
        tools: this.toolExecutor.getToolDefinitions()
      });

      const contentBlocks = response.content as Array<any>;
      const toolUses = contentBlocks.filter((block) => block.type === 'tool_use');
      const textBlocks = contentBlocks.filter((block) => block.type === 'text');
      const textReply = textBlocks.map((block) => block.text).join('');

      if (toolUses.length === 0) {
        return { reply: textReply };
      }

      messages.push({ role: 'assistant', content: contentBlocks });

      const toolResults: Array<any> = [];

      for (const toolUse of toolUses) {
        try {
          const toolName = toolUse.name as ToolName;
          const result = await this.toolExecutor.execute(toolName, toolUse.input, {
            sessionId: input.sessionId
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result)
          });
        } catch (error) {
          if (error instanceof PermissionRequiredError) {
            return {
              reply: `Permission required to run ${error.toolName}. Please confirm or adjust the request.`,
              stoppedBy: 'permission'
            };
          }

          if (error instanceof UserInputRequiredError) {
            return {
              reply: `More input needed: ${JSON.stringify(error.payload)}`,
              stoppedBy: 'user_input'
            };
          }

          if (error instanceof ToolBlockedError) {
            return {
              reply: `Tool execution blocked: ${error.reason || error.toolName}`,
              stoppedBy: 'permission'
            };
          }

          return { reply: `Tool execution failed: ${(error as Error).message}` };
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return { reply: 'Tool usage limit reached.', stoppedBy: 'tool_limit' };
  }
}
