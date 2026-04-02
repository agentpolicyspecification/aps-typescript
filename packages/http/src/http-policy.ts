import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "@agentpolicyspecification/core";
import type { InputContext, OutputContext, PolicyDecision, ToolCallContext } from "@agentpolicyspecification/core";
import { PolicyEvaluationError } from "@agentpolicyspecification/core";

export interface HttpClientOptions {
  /** Base URL of the remote policy server, e.g. "http://localhost:3000" */
  baseUrl: string;
}

type AnyContext = InputContext | ToolCallContext | OutputContext;

async function evaluate(
  id: string,
  options: HttpClientOptions,
  context: AnyContext,
  interceptionPoint: "input" | "tool_call" | "output"
): Promise<PolicyDecision> {
  const url = `${options.baseUrl}/aps/evaluate`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy_id: id, interception_point: interceptionPoint, context }),
    });
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new PolicyEvaluationError({
      policy_id: id,
      interception_point: interceptionPoint,
      cause: new Error(`Remote policy server returned HTTP ${response.status}: ${text}`),
    });
  }

  let decision: PolicyDecision;
  try {
    decision = (await response.json()) as PolicyDecision;
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  return decision;
}

// ─── Typed wrappers per interception point ────────────────────────────────────

export class HttpInputPolicy implements InputPolicy {
  constructor(
    readonly id: string,
    private readonly options: HttpClientOptions
  ) {}

  evaluate(context: InputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.options, context, "input");
  }
}

export class HttpToolCallPolicy implements ToolCallPolicy {
  constructor(
    readonly id: string,
    private readonly options: HttpClientOptions
  ) {}

  evaluate(context: ToolCallContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.options, context, "tool_call");
  }
}

export class HttpOutputPolicy implements OutputPolicy {
  constructor(
    readonly id: string,
    private readonly options: HttpClientOptions
  ) {}

  evaluate(context: OutputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.options, context, "output");
  }
}
