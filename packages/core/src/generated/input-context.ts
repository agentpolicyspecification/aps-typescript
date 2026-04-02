/* eslint-disable */
// This file is auto-generated from input-context.schema.json. Do not edit manually.

/**
 * The evaluation input provided to policies at the Input Interception point.
 */
export interface InputContext {
  /**
   * The ordered message history to be forwarded to the LLM runtime.
   */
  messages: Message[];
  metadata: Metadata;
}
export interface Message {
  /**
   * The role of the message author.
   */
  role: "system" | "user" | "assistant";
  /**
   * The text content of the message.
   */
  content: string;
}
export interface Metadata {
  /**
   * Unique identifier for the agent sending the message.
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
