import { randomUUID } from 'crypto';
import type { TaskInput } from '../types/tools';

export interface SubagentResult {
  agentId: string;
  output: string;
}

type SubagentRunner = (prompt: string, model?: string, workingDir?: string) => Promise<string>;

export class SubagentExecutor {
  private runner: SubagentRunner;

  constructor(runner: SubagentRunner) {
    this.runner = runner;
  }

  async runTask(input: TaskInput): Promise<SubagentResult> {
    const agentId = `subagent_${randomUUID()}`;
    const output = await this.runner(input.prompt, input.model, undefined);
    return { agentId, output };
  }
}
