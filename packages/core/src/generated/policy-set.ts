/* eslint-disable */
// This file is auto-generated from policy-set.schema.json. Do not edit manually.

/**
 * A collection of DSL policies with interception point and tool scope bindings
 */
export type PolicySet = ApsBase & {
  /**
   * The APS specification version this policy set targets (e.g. '0.1.0').
   */
  aps_version: string;
  /**
   * The list of policies in this set
   */
  policies: PolicyEntry[];
};
/**
 * A DSL policy rule with optional scope restrictions
 */
export type PolicyEntry = {
  [k: string]: unknown;
};

/**
 * Base schema for the Agent Policy Specification v0.1.0. All other APS schemas extend this schema. Defines shared types used across the specification.
 */
export interface ApsBase {
  [k: string]: unknown;
}
