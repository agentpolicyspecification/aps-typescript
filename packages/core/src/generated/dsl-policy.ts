/* eslint-disable */
// This file is auto-generated from dsl-policy.schema.json. Do not edit manually.

/**
 * A single Agent Policy Specification DSL policy rule
 */
export type DSLPolicy = {
  [k: string]: unknown;
} & {
  condition: Condition;
  /**
   * The action to take when the condition matches
   */
  action: "allow" | "deny" | "redact" | "transform" | "audit";
  /**
   * Optional human-readable reason for the action, typically used with deny
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
   * Field transformations to apply when action is 'transform'. Keys are dot-notation field paths, values are template strings supporting {{field.path}} interpolation.
   */
  transformation?: {
    [k: string]: string;
  };
};
/**
 * A condition that is evaluated against the context
 */
export type Condition = EqualsCondition | ContainsCondition | NotInCondition | GreaterThanCondition | AlwaysCondition;

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
  /**
   * Dot-notation path to the field in the context
   */
  field: string;
  /**
   * List of substrings to search for
   *
   * @minItems 1
   */
  contains: [string, ...string[]];
}
/**
 * Matches when the resolved field value is not present in the given list
 */
export interface NotInCondition {
  /**
   * Dot-notation path to the field in the context
   */
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
  /**
   * Dot-notation path to the field in the context
   */
  field: string;
  /**
   * The numeric threshold
   */
  greater_than: number;
}
/**
 * Always matches, regardless of context
 */
export interface AlwaysCondition {
  always: true;
}
