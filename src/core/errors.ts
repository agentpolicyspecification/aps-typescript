import type { InputContext, OutputContext, ToolCallContext } from "./types.js";

export type InterceptionPoint = "input" | "tool_call" | "output";

export class PolicyDenialError extends Error {
  readonly policy_id: string | undefined;
  readonly interception_point: InterceptionPoint;

  constructor(opts: {
    policy_id?: string;
    interception_point: InterceptionPoint;
    reason?: string;
  }) {
    super(opts.reason ?? "Request denied by policy.");
    this.name = "PolicyDenialError";
    this.policy_id = opts.policy_id;
    this.interception_point = opts.interception_point;
  }
}

export class PolicyEvaluationError extends Error {
  readonly policy_id: string;
  readonly interception_point: InterceptionPoint;
  readonly cause: unknown;

  constructor(opts: {
    policy_id: string;
    interception_point: InterceptionPoint;
    cause: unknown;
  }) {
    super(`Policy evaluation failed for '${opts.policy_id}' at '${opts.interception_point}'.`);
    this.name = "PolicyEvaluationError";
    this.policy_id = opts.policy_id;
    this.interception_point = opts.interception_point;
    this.cause = opts.cause;
  }
}

export type AuditRecord = {
  policy_id: string | undefined;
  decision: string;
  interception_point: InterceptionPoint;
  reason: string | undefined;
  context: InputContext | ToolCallContext | OutputContext;
  timestamp: string;
};
