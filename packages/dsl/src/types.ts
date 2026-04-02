import type { InputContext, OutputContext, ToolCallContext } from "@agentpolicyspecification/core";

export type AnyContext = InputContext | ToolCallContext | OutputContext;
