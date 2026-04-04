/* eslint-disable */
// This file is auto-generated from policy-set.schema.json. Do not edit manually.

/**
 * A condition evaluated against the context
 */
export type Condition = EqualsCondition | ContainsCondition | NotInCondition | GreaterThanCondition | AlwaysCondition;

/**
 * A collection of DSL policies with interception point and tool scope bindings
 */
export interface PolicySet {
  /**
   * The APS specification version this policy set targets (e.g. '0.1.0').
   */
  aps_version: string;
  /**
   * The list of policies in this set
   */
  policies: PolicyEntry[];
}
/**
 * A DSL policy rule with optional scope restrictions
 */
export interface PolicyEntry {
  condition: Condition;
  /**
   * The action to take when the condition matches
   */
  action: "allow" | "deny" | "redact" | "transform" | "audit";
  /**
   * Optional human-readable reason, typically used with deny
   */
  reason?: string;
  /**
   * Redaction instructions to apply when action is 'redact'.
   *
   * @minItems 1
   */
  redactions?: [
    {
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
    },
    ...{
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
    }[]
  ];
  /**
   * Field transformations when action is 'transform'. Keys are dot-notation field paths, values are template strings supporting {{field.path}} interpolation.
   */
  transformation?: {
    [k: string]: string;
  };
  /**
   * Interception points this policy applies to. Omit to apply to all points.
   *
   * @minItems 1
   */
  applies_to?: ["input" | "output" | "tool_call", ...("input" | "output" | "tool_call")[]];
  /**
   * Tool names this policy applies to. Only evaluated when applies_to includes 'tool_call'. Omit to apply to all tools.
   */
  tools?: string[];
}
/**
 * Matches when the resolved field value strictly equals the operand
 */
export interface EqualsCondition {
  /**
   * Dot-notation path to the field in the context (e.g. 'tool_name', 'messages.0.content')
   */
  field: string;
  /**
   * The value to compare against using strict equality
   */
  equals: {
    [k: string]: unknown;
  };
}
/**
 * Matches when the resolved field value contains any of the given substrings (case-insensitive)
 */
export interface ContainsCondition {
  field: string;
  /**
   * @minItems 1
   */
  contains: [string, ...string[]];
}
/**
 * Matches when the resolved field value is not present in the given list
 */
export interface NotInCondition {
  field: string;
  /**
   * List of values the field must not be equal to
   */
  not_in: unknown[];
}
/**
 * Matches when the resolved field value is numerically greater than the operand
 */
export interface GreaterThanCondition {
  field: string;
  greater_than: number;
}
/**
 * Always matches, regardless of context
 */
export interface AlwaysCondition {
  always: true;
}
