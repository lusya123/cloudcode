/**
 * Permission Checker for CloudClaude
 * Implements deny/allow/ask permission rules
 */

import { minimatch } from 'minimatch';
import { PermissionConfig } from '../types/config';
import { Logger } from '../utils/logger';

const logger = new Logger('PermissionChecker');

export type PermissionDecision = 'allow' | 'deny' | 'ask';

export class PermissionChecker {
    private config: PermissionConfig;

    constructor(config: PermissionConfig) {
        this.config = config;
    }

    /**
     * Check tool call permission
     * Order: deny → allow → ask → default
     */
    check(toolName: string, input: any): PermissionDecision {
        const pattern = this.buildPattern(toolName, input);

        // 1. Check deny rules
        for (const rule of this.config.deny) {
            if (this.matchRule(pattern, rule)) {
                logger.warn(`Permission denied: ${pattern} matches deny rule: ${rule}`);
                return 'deny';
            }
        }

        // 2. Check allow rules
        for (const rule of this.config.allow) {
            if (this.matchRule(pattern, rule)) {
                logger.debug(`Permission allowed: ${pattern} matches allow rule: ${rule}`);
                return 'allow';
            }
        }

        // 3. Check ask rules
        for (const rule of this.config.ask) {
            if (this.matchRule(pattern, rule)) {
                logger.debug(`Permission ask: ${pattern} matches ask rule: ${rule}`);
                return 'ask';
            }
        }

        // 4. Default behavior
        return this.getDefaultBehavior(toolName);
    }

    /**
     * Build pattern string from tool name and input
     */
    private buildPattern(toolName: string, input: any): string {
        switch (toolName) {
            case 'Bash':
                return `Bash(${input.command || ''})`;
            case 'Read':
                return `Read(${input.file_path || ''})`;
            case 'Write':
                return `Write(${input.file_path || ''})`;
            case 'Edit':
                return `Edit(${input.file_path || ''})`;
            case 'Glob':
                return `Glob(${input.pattern || ''})`;
            case 'Grep':
                return `Grep(${input.pattern || ''})`;
            default:
                return `${toolName}(*)`;
        }
    }

    /**
     * Match pattern against rule using minimatch
     */
    private matchRule(pattern: string, rule: string): boolean {
        // Extract tool name and argument
        const patternMatch = pattern.match(/^(\w+)\((.+)\)$/);
        const ruleMatch = rule.match(/^(\w+)\((.+)\)$/);

        if (!patternMatch || !ruleMatch) return false;

        const [, patternTool, patternArg] = patternMatch;
        const [, ruleTool, ruleArg] = ruleMatch;

        if (patternTool !== ruleTool) return false;

        return minimatch(patternArg, ruleArg);
    }

    /**
     * Get default behavior for tool type
     */
    private getDefaultBehavior(toolName: string): PermissionDecision {
        // Read-only tools default to allow
        const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'Skill'];
        if (readOnlyTools.includes(toolName)) {
            return 'allow';
        }
        // Other tools default to ask
        return 'ask';
    }

    /**
     * Update permission configuration
     */
    updateConfig(config: PermissionConfig): void {
        this.config = config;
        logger.info('Permission config updated');
    }
}
