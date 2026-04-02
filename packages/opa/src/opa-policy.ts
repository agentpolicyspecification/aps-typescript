import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "@agentpolicyspecification/core";
import type { InputContext, OutputContext, PolicyDecision, ToolCallContext } from "@agentpolicyspecification/core";
import { PolicyEvaluationError } from "@agentpolicyspecification/core";

export interface OpaClientOptions {
  /** Base URL of the OPA server, e.g. "http://localhost:8181" */
  baseUrl: string;
}

type AnyContext = InputContext | ToolCallContext | OutputContext;

async function evaluate(
  id: string,
  options: OpaClientOptions,
  packagePath: string,
  context: AnyContext,
  interceptionPoint: "input" | "tool_call" | "output"
): Promise<PolicyDecision> {
  const url = `${options.baseUrl}/v1/data/${packagePath}/decision`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: context }),
    });
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new PolicyEvaluationError({
      policy_id: id,
      interception_point: interceptionPoint,
      cause: new Error(`OPA returned HTTP ${response.status}: ${text}`),
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  const result = body["result"] as Record<string, unknown> | undefined;
  const decision = result?.["decision"];

  if (!decision) {
    throw new PolicyEvaluationError({
      policy_id: id,
      interception_point: interceptionPoint,
      cause: new Error("OPA produced no decision."),
    });
  }

  return {
    decision,
    ...(result["reason"] !== undefined && { reason: result["reason"] }),
    ...(result["redactions"] !== undefined && { redactions: result["redactions"] }),
    ...(result["transformation"] !== undefined && { transformation: result["transformation"] }),
  } as PolicyDecision;
}

// ─── Typed wrappers per interception point ────────────────────────────────────

export class OpaInputPolicy implements InputPolicy {
  constructor(
    readonly id: string,
    private readonly options: OpaClientOptions,
    /** Rego package path, e.g. "aps/input" */
    private readonly packagePath: string
  ) {}

  evaluate(context: InputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.options, this.packagePath, context, "input");
  }
}

export class OpaToolCallPolicy implements ToolCallPolicy {
  constructor(
    readonly id: string,
    private readonly options: OpaClientOptions,
    private readonly packagePath: string
  ) {}

  evaluate(context: ToolCallContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.options, this.packagePath, context, "tool_call");
  }
}

export class OpaOutputPolicy implements OutputPolicy {
  constructor(
    readonly id: string,
    private readonly options: OpaClientOptions,
    private readonly packagePath: string
  ) {}

  evaluate(context: OutputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.options, this.packagePath, context, "output");
  }
}
