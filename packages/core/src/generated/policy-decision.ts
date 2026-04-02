/* eslint-disable */
// This file is auto-generated from policy-decision.schema.json. Do not edit manually.

/**
 * The result produced by a policy evaluation at any interception point.
 */
export type PolicyDecision = AllowDecision | DenyDecision | RedactDecision | TransformDecision | AuditDecision;

export interface AllowDecision {
  decision: "allow";
}
export interface DenyDecision {
  decision: "deny";
  /**
   * Human-readable explanation for the denial. MAY be omitted for security-sensitive denials.
   */
  reason?: string;
  /**
   * Identifier of the policy that produced this denial.
   */
  policy_id?: string;
}
export interface RedactDecision {
  decision: "redact";
  /**
   * @minItems 1
   */
  redactions: [Redaction, ...Redaction[]];
}
export interface Redaction {
  /**
   * Dot-notation path to the field being redacted (e.g. 'response.content').
   */
  field: string;
  /**
   * 'mask' replaces with a fixed string, 'remove' deletes the field, 'replace' substitutes matched patterns.
   */
  strategy: "mask" | "remove" | "replace";
  /**
   * Replacement string. Required when strategy is 'mask' or 'replace'.
   */
  replacement?: string;
  /**
   * Regex pattern identifying the content to redact. Required when strategy is 'replace'.
   */
  pattern?: string;
}
export interface TransformDecision {
  decision: "transform";
  transformation: Transformation;
}
export interface Transformation {
  /**
   * Ordered list of transformation operations to apply.
   */
  operations: {
    /**
     * 'set' replaces the field value, 'prepend'/'append' adds content to a string field.
     */
    op: "set" | "prepend" | "append";
    /**
     * Dot-notation path to the field to transform.
     */
    field: string;
    /**
     * The value to apply. Type must match the target field.
     */
    value: unknown;
  }[];
}
export interface AuditDecision {
  decision: "audit";
  /**
   * Optional note to include in the audit record.
   */
  reason?: string;
}
