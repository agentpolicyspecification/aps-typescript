/* eslint-disable */
// This file is auto-generated from tool-call-context.schema.json. Do not edit manually.

/**
 * The evaluation input provided to policies at the Tool Call Interception point.
 */
export interface ToolCallContext {
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
}
export interface AssistantMessage {
  /**
   * Always 'assistant' — this is the message that produced the tool call.
   */
  role: "assistant";
  /**
   * The text content of the assistant message that triggered the tool call.
   */
  content: string;
}
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
