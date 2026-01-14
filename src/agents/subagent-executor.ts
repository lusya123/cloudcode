import type Anthropic from '@anthropic-ai/sdk';
import { AgenticLoop } from '../core/agentic-loop';
import type { PermissionChecker } from '../security/permission-checker';
import type { CommandFilter } from '../security/command-filter';
import type { McpClient } from '../mcp/mcp-client';
import type { ContextCompactor } from '../managers/context-compactor';

export interface AgentDefinition {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: 'sonnet' | 'opus' | 'haiku';
}

const builtInAgents: Record<string, AgentDefinition> = {
  'code-reviewer': {
    name: 'code-reviewer',
    description: 'Code quality review for security, style, and best practices',
    prompt: `You are a code reviewer. Analyze code for:
- Code quality and style
- Security vulnerabilities
- Performance issues
- Best practices
Provide specific, actionable feedback.`,
    tools: ['Read', 'Grep', 'Glob']
  },
  'test-runner': {
    name: 'test-runner',
    description: 'Run tests and analyze results',
    prompt: `You are a test runner. Your job is to:
- Run tests using appropriate commands
- Analyze test results
- Report failures with details
- Suggest fixes for failing tests`,
    tools: ['Bash', 'Read', 'Grep']
  },
  explorer: {
    name: 'explorer',
    description: 'Explore codebase structure and contents',
    prompt: `You are a codebase explorer. Help users understand:
- Project structure
- File organization
- Key components
- Dependencies`,
    tools: ['Read', 'Glob', 'Grep', 'Bash']
  }
};

export class SubagentExecutor {
  private definitions: Record<string, AgentDefinition>;
  private parentTools: Anthropic.Tool[];
  private permissionChecker?: PermissionChecker;
  private commandFilter?: CommandFilter;
  private mcpClient?: McpClient;
  private contextCompactor?: ContextCompactor;
  private defaultModel?: string;

  constructor(
    definitions: Record<string, AgentDefinition>,
    parentTools: Anthropic.Tool[],
    options: {
      permissionChecker?: PermissionChecker;
      commandFilter?: CommandFilter;
      mcpClient?: McpClient;
      contextCompactor?: ContextCompactor;
      defaultModel?: string;
    } = {}
  ) {
    this.definitions = { ...builtInAgents, ...definitions };
    this.parentTools = parentTools;
    this.permissionChecker = options.permissionChecker;
    this.commandFilter = options.commandFilter;
    this.mcpClient = options.mcpClient;
    this.contextCompactor = options.contextCompactor;
    this.defaultModel = options.defaultModel;
  }

  async execute(
    agentType: string,
    prompt: string,
    workingDir: string
  ): Promise<{ result: string; agentId: string }> {
    const definition = this.definitions[agentType];
    if (!definition) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const tools = definition.tools
      ? this.parentTools.filter(t => definition.tools!.includes(t.name))
      : this.parentTools;

    const loop = new AgenticLoop({
      workingDir,
      systemPrompt: definition.prompt,
      tools,
      maxTurns: 50,
      permissionChecker: this.permissionChecker,
      commandFilter: this.commandFilter,
      mcpClient: this.mcpClient,
      contextCompactor: this.contextCompactor,
      model: definition.model || this.defaultModel
    });

    const result = await loop.run(prompt);
    const agentId = `subagent_${Date.now()}`;

    return { result, agentId };
  }

  async executeParallel(
    tasks: Array<{ agentType: string; prompt: string }>,
    workingDir: string
  ): Promise<Array<{ agentType: string; result: string }>> {
    const promises = tasks.map(task =>
      this.execute(task.agentType, task.prompt, workingDir)
        .then(r => ({ agentType: task.agentType, result: r.result }))
    );

    return Promise.all(promises);
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }
}
