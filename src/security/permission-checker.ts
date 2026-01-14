import { minimatch } from 'minimatch';

interface PermissionConfig {
  deny: string[];
  allow: string[];
  ask: string[];
}

export class PermissionChecker {
  private config: PermissionConfig;

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  check(toolName: string, input: any): 'allow' | 'deny' | 'ask' {
    const pattern = this.buildPattern(toolName, input);

    for (const rule of this.config.deny) {
      if (this.matchRule(pattern, rule)) {
        return 'deny';
      }
    }

    for (const rule of this.config.allow) {
      if (this.matchRule(pattern, rule)) {
        return 'allow';
      }
    }

    for (const rule of this.config.ask) {
      if (this.matchRule(pattern, rule)) {
        return 'ask';
      }
    }

    return this.getDefaultBehavior(toolName);
  }

  private buildPattern(toolName: string, input: any): string {
    switch (toolName) {
      case 'Bash':
        return `Bash(${input.command})`;
      case 'Read':
        return `Read(${input.file_path})`;
      case 'Write':
        return `Write(${input.file_path})`;
      case 'Edit':
        return `Edit(${input.file_path})`;
      default:
        return `${toolName}(*)`;
    }
  }

  private matchRule(pattern: string, rule: string): boolean {
    const patternMatch = pattern.match(/^(\w+)\((.+)\)$/);
    const ruleMatch = rule.match(/^(\w+)\((.+)\)$/);

    if (!patternMatch || !ruleMatch) return false;

    const [, patternTool, patternArg] = patternMatch;
    const [, ruleTool, ruleArg] = ruleMatch;

    if (patternTool !== ruleTool) return false;

    return minimatch(patternArg, ruleArg);
  }

  private getDefaultBehavior(toolName: string): 'allow' | 'deny' | 'ask' {
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch'];
    if (readOnlyTools.includes(toolName)) {
      return 'allow';
    }
    return 'ask';
  }
}
