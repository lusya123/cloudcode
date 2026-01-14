import Anthropic from '@anthropic-ai/sdk';
import { ToolExecutor } from '../executors/tool-executor';
import type { HooksManager } from './hooks-manager';
import type { PermissionChecker } from '../security/permission-checker';
import type { CommandFilter } from '../security/command-filter';
import type { McpClient } from '../mcp/mcp-client';
import type { SubagentExecutor } from '../agents/subagent-executor';
import type { ContextCompactor } from '../managers/context-compactor';
import type { SessionMessage } from '../types/session';
import { Logger } from '../utils/logger';

interface AgenticLoopOptions {
  workingDir: string;
  maxTurns?: number;
  systemPrompt?: string;
  tools: Anthropic.Tool[];
  hooks?: HooksManager;
  initialMessages?: SessionMessage[];
  permissionChecker?: PermissionChecker;
  commandFilter?: CommandFilter;
  allowedPaths?: string[];
  mcpClient?: McpClient;
  subagentExecutor?: SubagentExecutor;
  contextCompactor?: ContextCompactor;
  client?: Anthropic;
  model?: string;
}

export class AgenticLoop {
  private client: Anthropic;
  private executor: ToolExecutor;
  private options: AgenticLoopOptions;
  private messages: SessionMessage[] = [];
  private hooks?: HooksManager;
  private logger: Logger;
  private compactor?: ContextCompactor;

  constructor(options: AgenticLoopOptions) {
    this.client = options.client || new Anthropic();
    this.executor = new ToolExecutor(options.workingDir, {
      permissionChecker: options.permissionChecker,
      commandFilter: options.commandFilter,
      allowedPaths: options.allowedPaths,
      mcpClient: options.mcpClient,
      subagentExecutor: options.subagentExecutor
    });
    this.options = options;
    this.hooks = options.hooks;
    this.messages = options.initialMessages ? [...options.initialMessages] : [];
    this.logger = new Logger('AgenticLoop');
    this.compactor = options.contextCompactor;
  }

  async run(userMessage: string): Promise<string> {
    if (this.hooks) {
      const hookResult = await this.hooks.trigger('UserPromptSubmit', {
        userMessage
      });
      if (hookResult.modifiedInput?.userMessage) {
        userMessage = hookResult.modifiedInput.userMessage;
      }
    }

    this.messages.push({
      role: 'user',
      content: userMessage
    });

    let turns = 0;
    const maxTurns = this.options.maxTurns || 100;

    while (turns < maxTurns) {
      turns++;
      this.logger.info(`Turn ${turns}/${maxTurns}`);

      if (this.compactor) {
        const estimatedTokens = this.compactor.estimateTokens(this.messages);
        if (this.compactor.needsCompaction(this.messages, estimatedTokens)) {
          this.messages = await this.compactor.compact(this.messages, this.client);
        }
      }

      const response = await this.client.messages.create({
        model: this.options.model || 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: this.options.systemPrompt || this.getDefaultSystemPrompt(),
        tools: this.options.tools,
        messages: this.messages
      });

      const toolUseBlocks = response.content.filter(
        block => block.type === 'tool_use'
      );

      this.messages.push({
        role: 'assistant',
        content: response.content
      });

      if (toolUseBlocks.length === 0) {
        const textBlocks = response.content.filter(
          block => block.type === 'text'
        );
        return textBlocks.map(block => block.text).join('\n');
      }

      const toolResults = await this.executeTools(toolUseBlocks);

      this.messages.push({
        role: 'user',
        content: toolResults
      });

      if (response.stop_reason === 'end_turn') {
        const textBlocks = response.content.filter(
          block => block.type === 'text'
        );
        if (textBlocks.length > 0) {
          return textBlocks.map(block => block.text).join('\n');
        }
      }
    }

    throw new Error(`Exceeded maximum turns (${maxTurns})`);
  }

  private async executeTools(toolUseBlocks: any[]): Promise<any[]> {
    const results = [];

    for (const block of toolUseBlocks) {
      const { id, name, input } = block;
      this.logger.info(`Executing tool: ${name}`);

      try {
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

        const output = await this.executor.execute(name, input);

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
        this.logger.error(`Tool execution failed: ${name}`, { error: error.message });
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

  private getDefaultSystemPrompt(): string {
    return `You are CloudClaude, an AI assistant running on a cloud server.
You have access to tools that allow you to execute commands, read/write files, and search content.
Your working directory is: ${this.options.workingDir}

Always use tools to accomplish tasks. Be careful with destructive operations.
When executing bash commands, prefer to show the output to the user.`;
  }

  getMessages(): SessionMessage[] {
    return [...this.messages];
  }

  setMessages(messages: SessionMessage[]): void {
    this.messages = [...messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  updateClient(client: Anthropic): void {
    this.client = client;
  }

  updateModel(model: string): void {
    this.options.model = model;
  }
}
