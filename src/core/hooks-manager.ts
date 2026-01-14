import type { HookContext, HookMatcher, HookResult, HookType } from '../types/hooks';

export class HooksManager {
  private hooks: Map<HookType, HookMatcher[]> = new Map();

  register(type: HookType, matcher: HookMatcher): void {
    const existing = this.hooks.get(type) || [];
    existing.push(matcher);
    this.hooks.set(type, existing);
  }

  async trigger(type: HookType, context: HookContext): Promise<HookResult> {
    const matchers = this.hooks.get(type) || [];

    for (const matcher of matchers) {
      if (!this.matchesMatcher(context, matcher)) {
        continue;
      }

      for (const hookFn of matcher.hooks) {
        try {
          const result = await Promise.race([
            hookFn(context),
            this.timeout(matcher.timeout || 5000)
          ]);

          if (result.decision === 'block') {
            return result;
          }

          if (result.modifiedInput) {
            context.input = result.modifiedInput;
          }
          if (result.modifiedOutput) {
            context.output = result.modifiedOutput;
          }
        } catch {
          continue;
        }
      }
    }

    return { decision: 'allow' };
  }

  private matchesMatcher(context: HookContext, matcher: HookMatcher): boolean {
    if (!context.toolName) {
      return true;
    }

    if (typeof matcher.matcher === 'string') {
      return context.toolName === matcher.matcher || matcher.matcher === '*';
    }

    return matcher.matcher.test(context.toolName);
  }

  private timeout(ms: number): Promise<HookResult> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('Hook timeout')), ms));
  }
}
