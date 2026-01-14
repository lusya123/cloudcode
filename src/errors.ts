import type { AskUserQuestionInput } from './types/tools';

export class PermissionRequiredError extends Error {
  readonly toolName: string;
  readonly input: unknown;

  constructor(toolName: string, input: unknown, message?: string) {
    super(message || `Permission required for ${toolName}`);
    this.name = 'PermissionRequiredError';
    this.toolName = toolName;
    this.input = input;
  }
}

export class ToolBlockedError extends Error {
  readonly toolName: string;
  readonly reason?: string;

  constructor(toolName: string, reason?: string) {
    super(reason || `Tool ${toolName} blocked`);
    this.name = 'ToolBlockedError';
    this.toolName = toolName;
    this.reason = reason;
  }
}

export class UserInputRequiredError extends Error {
  readonly payload: AskUserQuestionInput;

  constructor(payload: AskUserQuestionInput) {
    super('User input required');
    this.name = 'UserInputRequiredError';
    this.payload = payload;
  }
}
