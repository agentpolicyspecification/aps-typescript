import type { InputContext, OutputContext, PolicyDecision, ToolCallContext, InputPolicy, OutputPolicy, ToolCallPolicy, DSLPolicy } from "@agentpolicyspecification/core";
import { PolicyEvaluationError } from "@agentpolicyspecification/core";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { evaluateCondition } from "./condition.js";
import { actionBuilders } from "./actions.js";
import type { AnyContext } from "./types.js";

async function evaluate(
  id: string,
  bundlePath: string,
  context: AnyContext,
  interceptionPoint: "input" | "tool_call" | "output"
): Promise<PolicyDecision> {
  let policy: DSLPolicy;
  try {
    const raw = await readFile(join(bundlePath, `${id}.json`), "utf-8");
    policy = JSON.parse(raw) as DSLPolicy;
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  if (!evaluateCondition(policy.condition, context)) {
    return { decision: "allow" };
  }

  return actionBuilders[policy.action](policy, context);
}

// ─── Typed wrappers per interception point ────────────────────────────────────

export class DslInputPolicy implements InputPolicy {
  constructor(
    readonly id: string,
    private readonly bundlePath: string
  ) { }

  evaluate(context: InputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.bundlePath, context, "input");
  }
}

export class DslToolCallPolicy implements ToolCallPolicy {
  constructor(
    readonly id: string,
    private readonly bundlePath: string
  ) { }

  evaluate(context: ToolCallContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.bundlePath, context, "tool_call");
  }
}

export class DslOutputPolicy implements OutputPolicy {
  constructor(
    readonly id: string,
    private readonly bundlePath: string
  ) { }

  evaluate(context: OutputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.bundlePath, context, "output");
  }
}
