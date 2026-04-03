/* eslint-disable */
// This file is auto-generated from tool-call-context.schema.json. Do not edit manually.

/**
 * The evaluation input provided to policies at the Tool Call Interception point.
 */
export type ToolCallContext = ApsBase & {
  /**
   * The name of the tool the LLM has requested to invoke.
   */
  tool_name: string;
  /**
   * The arguments provided by the LLM for the tool invocation.
   */
  arguments: {
    [k: string]: unknown;
  };
  calling_message: AssistantMessage;
  metadata: Metadata;
};

/**
 * Base schema for the Agent Policy Specification v0.1.0. All other APS schemas extend this schema. Defines shared types used across the specification.
 */
export interface ApsBase {
  [k: string]: unknown;
}
/**
 * A message produced by the LLM (role must be 'assistant').
 */
export interface AssistantMessage {
  role: "assistant";
  /**
   * The text content of the assistant message.
   */
  content: string;
}
/**
 * Common metadata attached to every APS context object.
 */
export interface Metadata {
  /**
   * Unique identifier for the agent that owns this session.
   */
  agent_id: string;
  /**
   * Unique identifier for the current session.
   */
  session_id: string;
  /**
   * ISO 8601 timestamp of when the interception occurred.
   */
  timestamp: string;
  [k: string]: unknown;
}
