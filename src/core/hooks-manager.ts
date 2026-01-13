/**
 * Hooks Manager for CloudClaude
 * Manages PreToolUse, PostToolUse, and other event hooks
 */

import { Logger } from '../utils/logger';
import { HookType, HookContext, HookResult, HookMatcher } from '../types/hooks';

const logger = new Logger('HooksManager');

export class HooksManager {
    private hooks: Map<HookType, HookMatcher[]> = new Map();

    /**
     * Register a hook
     */
    register(type: HookType, matcher: HookMatcher): void {
        const existing = this.hooks.get(type) || [];
        existing.push(matcher);
        this.hooks.set(type, existing);
        logger.debug(`Registered ${type} hook with matcher: ${matcher.matcher}`);
    }

    /**
     * Trigger hooks of a specific type
     */
    async trigger(type: HookType, context: HookContext): Promise<HookResult> {
        const matchers = this.hooks.get(type) || [];

        for (const matcher of matchers) {
            // Check if context matches
            if (!this.matchesMatcher(context, matcher)) {
                continue;
            }

            // Execute all hook functions
            for (const hookFn of matcher.hooks) {
                try {
                    const result = await Promise.race([
                        hookFn(context),
                        this.timeout(matcher.timeout || 5000)
                    ]);

                    // If blocked, return immediately
                    if (result.decision === 'block') {
                        logger.info(`Hook blocked: ${type} for ${context.toolName}`, { reason: result.reason });
                        return result;
                    }

                    // If input/output modified, update context
                    if (result.modifiedInput) {
                        context.input = result.modifiedInput;
                    }
                    if (result.modifiedOutput) {
                        context.output = result.modifiedOutput;
                    }
                } catch (error) {
                    logger.error(`Hook execution failed for ${type}`, error as Error);
                }
            }
        }

        return { decision: 'allow' };
    }

    /**
     * Check if context matches the matcher
     */
    private matchesMatcher(context: HookContext, matcher: HookMatcher): boolean {
        if (!context.toolName) return true;

        if (typeof matcher.matcher === 'string') {
            return context.toolName === matcher.matcher || matcher.matcher === '*';
        }

        return matcher.matcher.test(context.toolName);
    }

    /**
     * Timeout promise
     */
    private timeout(ms: number): Promise<HookResult> {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Hook timeout')), ms)
        );
    }

    /**
     * Remove all hooks of a type
     */
    clear(type?: HookType): void {
        if (type) {
            this.hooks.delete(type);
        } else {
            this.hooks.clear();
        }
    }

    /**
     * Get registered hooks count
     */
    getHooksCount(): Record<HookType, number> {
        const counts: Record<string, number> = {};
        for (const [type, matchers] of this.hooks) {
            counts[type] = matchers.length;
        }
        return counts as Record<HookType, number>;
    }
}

// Default hooks manager with safety hooks pre-registered
export function createDefaultHooksManager(): HooksManager {
    const manager = new HooksManager();

    // Block dangerous rm -rf commands
    manager.register('PreToolUse', {
        matcher: 'Bash',
        hooks: [
            async (context) => {
                const command = context.input?.command || '';
                if (/rm\s+(-rf?|--recursive)\s+[\/~]/.test(command)) {
                    return {
                        decision: 'block',
                        reason: 'Dangerous rm command blocked for safety'
                    };
                }
                return { decision: 'allow' };
            }
        ]
    });

    // Log all tool executions
    manager.register('PostToolUse', {
        matcher: '*',
        hooks: [
            async (context) => {
                logger.info(`Tool executed: ${context.toolName}`, {
                    toolUseId: context.toolUseId,
                    hasOutput: !!context.output
                });
                return { decision: 'allow' };
            }
        ]
    });

    return manager;
}
