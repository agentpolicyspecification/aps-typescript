import { loadPolicy } from "@open-policy-agent/opa-wasm";
import { readFile } from "fs/promises";
import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "../core/policy.js";
import type { InputContext, OutputContext, PolicyDecision, ToolCallContext } from "../core/types.js";
import { PolicyEvaluationError } from "../core/errors.js";

type AnyContext = InputContext | ToolCallContext | OutputContext;

async function evaluate(
  id: string,
  wasmPath: string,
  context: AnyContext,
  interceptionPoint: "input" | "tool_call" | "output"
): Promise<PolicyDecision> {
  let policy;

  try {
    const bytes = await readFile(wasmPath);
    policy = await loadPolicy(bytes);
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  let result;
  try {
    result = policy.evaluate(context);
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  const decision = result?.[0]?.result?.decision;
  if (!decision) {
    throw new PolicyEvaluationError({
      policy_id: id,
      interception_point: interceptionPoint,
      cause: new Error("Policy produced no decision."),
    });
  }

  return {
    decision,
    ...(result[0].result.reason && { reason: result[0].result.reason }),
    ...(result[0].result.redactions && { redactions: result[0].result.redactions }),
    ...(result[0].result.transformation && { transformation: result[0].result.transformation }),
  } as PolicyDecision;
}

// ─── Typed wrappers per interception point ────────────────────────────────────

export class RegoInputPolicy implements InputPolicy {
  constructor(
    readonly id: string,
    private readonly wasmPath: string
  ) {}

  evaluate(context: InputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.wasmPath, context, "input");
  }
}

export class RegoToolCallPolicy implements ToolCallPolicy {
  constructor(
    readonly id: string,
    private readonly wasmPath: string
  ) {}

  evaluate(context: ToolCallContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.wasmPath, context, "tool_call");
  }
}

export class RegoOutputPolicy implements OutputPolicy {
  constructor(
    readonly id: string,
    private readonly wasmPath: string
  ) {}

  evaluate(context: OutputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.wasmPath, context, "output");
  }
}
