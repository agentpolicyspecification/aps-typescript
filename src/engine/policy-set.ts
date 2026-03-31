import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "../core/policy.js";

export type OnErrorBehavior = "deny" | "allow";

export interface PolicySet {
  on_error?: OnErrorBehavior;
  input?: InputPolicy[];
  tool_call?: ToolCallPolicy[];
  output?: OutputPolicy[];
}
