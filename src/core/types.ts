// ─── Shared ──────────────────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface Metadata {
  agent_id: string;
  session_id: string;
  timestamp: string;
  [key: string]: unknown;
}

// ─── Interception Contexts ────────────────────────────────────────────────────

export interface InputContext {
  messages: Message[];
  metadata: Metadata;
}

export interface ToolCallContext {
  tool_name: string;
  arguments: Record<string, unknown>;
  calling_message: Message & { role: "assistant" };
  metadata: Metadata;
}

export interface OutputContext {
  response: Message & { role: "assistant" };
  metadata: Metadata;
}

// ─── Policy Decisions ─────────────────────────────────────────────────────────

export interface AllowDecision {
  decision: "allow";
}

export interface DenyDecision {
  decision: "deny";
  reason?: string;
  policy_id?: string;
}

export interface RedactDecision {
  decision: "redact";
  redactions: Redaction[];
}

export interface TransformDecision {
  decision: "transform";
  transformation: Transformation;
}

export interface AuditDecision {
  decision: "audit";
  reason?: string;
}

export type PolicyDecision =
  | AllowDecision
  | DenyDecision
  | RedactDecision
  | TransformDecision
  | AuditDecision;

// ─── Redaction ────────────────────────────────────────────────────────────────

export type RedactionStrategy = "mask" | "remove" | "replace";

export interface Redaction {
  field: string;
  strategy: RedactionStrategy;
  replacement?: string;
  pattern?: string;
}

// ─── Transformation ───────────────────────────────────────────────────────────

export type TransformOp = "set" | "prepend" | "append";

export interface TransformOperation {
  op: TransformOp;
  field: string;
  value: unknown;
}

export interface Transformation {
  operations: TransformOperation[];
}
