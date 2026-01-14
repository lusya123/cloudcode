import { minimatch } from 'minimatch';
import type { PermissionsRules } from '../types/config';

export class PermissionChecker {
  private rules: PermissionsRules;

  constructor(rules: PermissionsRules) {
    this.rules = rules;
  }

  check(toolName: string, input: Record<string, unknown>): 'allow' | 'deny' | 'ask' {
    const pattern = this.buildPattern(toolName, input);

    for (const rule of this.rules.deny) {
      if (this.matchRule(pattern, rule)) {
        return 'deny';
      }
    }

    for (const rule of this.rules.allow) {
      if (this.matchRule(pattern, rule)) {
        return 'allow';
      }
    }

    for (const rule of this.rules.ask) {
      if (this.matchRule(pattern, rule)) {
        return 'ask';
      }
    }

    return this.getDefaultBehavior(toolName);
  }

  private buildPattern(toolName: string, input: Record<string, unknown>): string {
    switch (toolName) {
      case 'Bash':
        return `Bash(${String(input.command ?? '')})`;
      case 'Read':
        return `Read(${String(input.file_path ?? '')})`;
      case 'Write':
        return `Write(${String(input.file_path ?? '')})`;
      case 'Edit':
        return `Edit(${String(input.file_path ?? '')})`;
      default:
        return `${toolName}(*)`;
    }
  }

  private matchRule(pattern: string, rule: string): boolean {
    const patternMatch = pattern.match(/^(\w+)\((.+)\)$/);
    const ruleMatch = rule.match(/^(\w+)\((.+)\)$/);

    if (!patternMatch || !ruleMatch) {
      return false;
    }

    const [, patternTool, patternArg] = patternMatch;
    const [, ruleTool, ruleArg] = ruleMatch;

    if (patternTool !== ruleTool) {
      return false;
    }

    return minimatch(patternArg, ruleArg, { dot: true, nocase: false });
  }

  private getDefaultBehavior(toolName: string): 'allow' | 'deny' | 'ask' {
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch'];
    if (readOnlyTools.includes(toolName)) {
      return 'allow';
    }
    return 'ask';
  }
}
