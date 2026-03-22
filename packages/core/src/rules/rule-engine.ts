import type { AgentAction, AgentContext, Rule, RuleResult } from "../types/index.js";

export class RuleEngine {
  private rules: Rule[];

  constructor(rules: Rule[] = []) {
    this.rules = rules;
  }

  async validate(action: AgentAction, context: AgentContext): Promise<RuleResult> {
    for (const rule of this.rules) {
      const result = await rule.check(action, context);

      if (!result.allowed) return result;
    }

    return { allowed: true };
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  removeRule(name: string): void {
    this.rules = this.rules.filter((r) => r.name !== name);
  }

  getRules(): Rule[] {
    return [...this.rules];
  }
}

// ─── Built-in rules ───────────────────────────────────────────────────────────

/** Block specific tool names from being called */
export function blockToolsRule(blockedTools: string[]): Rule {
  return {
    name: "block-tools",
    description: `Block calls to: ${blockedTools.join(", ")}`,
    async check(action) {
      if (action.type !== "tool_call") return { allowed: true };
      const toolName = (action.payload as { name?: string }).name;
      if (toolName && blockedTools.includes(toolName)) {
        return { allowed: false, reason: `Tool "${toolName}" is not allowed` };
      }
      return { allowed: true };
    },
  };
}

/** Allow only specific tools, block everything else */
export function allowToolsRule(allowedTools: string[]): Rule {
  return {
    name: "allow-tools",
    description: `Only allow calls to: ${allowedTools.join(", ")}`,
    async check(action) {
      if (action.type !== "tool_call") return { allowed: true };
      const toolName = (action.payload as { name?: string }).name;
      if (toolName && !allowedTools.includes(toolName)) {
        return { allowed: false, reason: `Tool "${toolName}" is not in the allowed list` };
      }
      return { allowed: true };
    },
  };
}

/** Require a userId to be present in context */
export function requireAuthRule(): Rule {
  return {
    name: "require-auth",
    description: "Require authenticated user",
    async check(_action, context) {
      if (!context.userId) {
        return { allowed: false, reason: "Authentication required" };
      }
      return { allowed: true };
    },
  };
}

/** Rate limiting rule — max N actions per session */
export function rateLimitRule(maxActions: number): Rule {
  const counts = new Map<string, number>();

  return {
    name: "rate-limit",
    description: `Max ${maxActions} actions per session`,
    async check(_action, context) {
      const count = counts.get(context.sessionId) ?? 0;
      if (count >= maxActions) {
        return {
          allowed: false,
          reason: `Rate limit exceeded (${maxActions} actions per session)`,
        };
      }
      counts.set(context.sessionId, count + 1);
      return { allowed: true };
    },
  };
}
