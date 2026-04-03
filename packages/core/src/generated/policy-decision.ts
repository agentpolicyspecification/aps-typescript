/* eslint-disable */
// This file is auto-generated from policy-decision.schema.json. Do not edit manually.

/**
 * The result produced by a policy evaluation at any interception point.
 */
export type PolicyDecision = ApsBase &
  (AllowDecision | DenyDecision | RedactDecision | TransformDecision | AuditDecision);

/**
 * Base schema for the Agent Policy Specification v0.1.0. All other APS schemas extend this schema. Defines shared types used across the specification.
 */
export interface ApsBase {
  [k: string]: unknown;
}
export interface AllowDecision {
  decision: "allow";
  /**
   * When true, an audit record is also produced for this interaction.
   */
  audit?: boolean;
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
  /**
   * When true, an audit record is also produced for this interaction.
   */
  audit?: boolean;
}
export interface RedactDecision {
  decision: "redact";
  /**
   * @minItems 1
   */
  redactions: [Redaction, ...Redaction[]];
  /**
   * When true, an audit record is also produced for this interaction.
   */
  audit?: boolean;
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
  /**
   * When true, an audit record is also produced for this interaction.
   */
  audit?: boolean;
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
    value: {
      [k: string]: unknown;
    };
  }[];
}
/**
 * Produces only an audit record; the interaction proceeds unchanged.
 */
export interface AuditDecision {
  decision: "audit";
  /**
   * Optional note to include in the audit record.
   */
  reason?: string;
}
