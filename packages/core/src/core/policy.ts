import type { PolicyDecision } from "../generated/policy-decision.js";
import type { InputContext } from "../generated/input-context.js";
import type { OutputContext } from "../generated/output-context.js";
import type { ToolCallContext } from "../generated/tool-call-context.js";

export interface InputPolicy {
  readonly id: string;
  evaluate(context: InputContext): Promise<PolicyDecision> | PolicyDecision;
}

export interface ToolCallPolicy {
  readonly id: string;
  evaluate(context: ToolCallContext): Promise<PolicyDecision> | PolicyDecision;
}

export interface OutputPolicy {
  readonly id: string;
  evaluate(context: OutputContext): Promise<PolicyDecision> | PolicyDecision;
}
