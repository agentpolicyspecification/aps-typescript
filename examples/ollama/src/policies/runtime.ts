import { ApsEngine } from "@agentpolicyspecification/core";
import type {
  InputPolicy, InputContext,
  OutputPolicy, OutputContext,
  ToolCallPolicy, ToolCallContext,
  PolicyDecision,
} from "@agentpolicyspecification/core";

class NoSsnPolicy implements InputPolicy {
  readonly id = "no-ssn";

  evaluate(ctx: InputContext): PolicyDecision {
    const hasSsn = ctx.messages.some(m => /\b\d{3}-\d{2}-\d{4}\b/.test(m.content));
    return hasSsn
      ? { decision: "deny", reason: "Message contains a potential SSN." }
      : { decision: "allow" };
  }
}

class NoConfidentialOutputPolicy implements OutputPolicy {
  readonly id = "no-confidential-output";

  evaluate(ctx: OutputContext): PolicyDecision {
    const blocked = ["confidential", "internal only"];
    const lower = ctx.response.content.toLowerCase();
    const found = blocked.find(w => lower.includes(w));
    return found
      ? { decision: "deny", reason: `Response contains restricted term: "${found}".` }
      : { decision: "allow" };
  }
}

const BLOCKED_TOOLS = new Set(["delete_file", "drop_table", "execute_shell"]);

class NoBlockedToolsPolicy implements ToolCallPolicy {
  readonly id = "no-blocked-tools";

  evaluate(ctx: ToolCallContext): PolicyDecision {
    return BLOCKED_TOOLS.has(ctx.tool_name)
      ? { decision: "deny", reason: `Tool "${ctx.tool_name}" is not permitted.` }
      : { decision: "allow" };
  }
}

export function createRuntimeEngine(): ApsEngine {
  return new ApsEngine({
    policySet: {
      input: [new NoSsnPolicy()],
      output: [new NoConfidentialOutputPolicy()],
      tool_call: [new NoBlockedToolsPolicy()],
    },
  });
}
