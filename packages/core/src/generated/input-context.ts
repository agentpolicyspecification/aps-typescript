/* eslint-disable */
// This file is auto-generated from input-context.schema.json. Do not edit manually.

/**
 * The evaluation input provided to policies at the Input Interception point.
 */
export type InputContext = ApsBase & {
  /**
   * The ordered message history to be forwarded to the LLM runtime.
   */
  messages: Message[];
  metadata: Metadata;
};

/**
 * Base schema for the Agent Policy Specification v0.1.0. All other APS schemas extend this schema. Defines shared types used across the specification.
 */
export interface ApsBase {
  [k: string]: unknown;
}
/**
 * A single message in a conversation.
 */
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
