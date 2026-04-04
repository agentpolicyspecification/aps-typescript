import type { InputContext, OutputContext, ToolCallContext, Condition, DSLPolicy } from "@agentpolicyspecification/core";

export type AnyContext = InputContext | ToolCallContext | OutputContext;
export type { Condition, DSLPolicy };
