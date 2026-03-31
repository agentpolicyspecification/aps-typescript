import type { InputContext, OutputContext, PolicyDecision, ToolCallContext } from "./types.js";

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
