import { ApsEngine } from "@agentpolicyspecification/core";
import type { AuditHandler } from "@agentpolicyspecification/core";
import type { InputPolicy, InputContext, PolicyDecision, OutputPolicy, OutputContext } from "@agentpolicyspecification/core";

/**
 * Runtime policy: plain TypeScript — no external tools or files needed.
 */
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

export function createRuntimeEngine(onAudit: AuditHandler): ApsEngine {
  return new ApsEngine({
    policySet: {
      input: [new NoSsnPolicy()],
      output: [new NoConfidentialOutputPolicy()],
    },
    onAudit,
  });
}
