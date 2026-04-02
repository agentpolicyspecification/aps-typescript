/* eslint-disable */
// This file is auto-generated from output-context.schema.json. Do not edit manually.

/**
 * The evaluation input provided to policies at the Output Interception point.
 */
export interface OutputContext {
  response: AssistantMessage;
  metadata: Metadata;
}
export interface AssistantMessage {
  /**
   * Always 'assistant' — this is the LLM response being evaluated.
   */
  role: "assistant";
  /**
   * The text content of the LLM response.
   */
  content: string;
}
export interface Metadata {
  /**
   * Unique identifier for the agent receiving the response.
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
