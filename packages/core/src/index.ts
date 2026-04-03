export type {
  Message,
  InputContext,
} from "./generated/input-context.js";

export type {
  OutputContext,
  Metadata,
} from './generated/output-context.js';

export type {
  ToolCallContext,
  AssistantMessage,
} from './generated/tool-call-context.js';

export type {
  PolicyDecision,
  AllowDecision,
  DenyDecision,
  RedactDecision,
  TransformDecision,
  AuditDecision,
  Redaction,
  Transformation,
} from './generated/policy-decision.js';

export type {
  DSLPolicy,
  Condition,
  EqualsCondition,
  ContainsCondition,
  NotInCondition,
  GreaterThanCondition,
  AlwaysCondition,
} from './generated/dsl-policy.js';

export type {
  PolicySet as JsonPolicySet,
  PolicyEntry,
} from './generated/policy-set.js';

export type { InputPolicy, ToolCallPolicy, OutputPolicy } from "./core/policy.js";

export {
  PolicyDenialError,
  PolicyEvaluationError,
} from "./core/errors.js";
export type { AuditRecord, InterceptionPoint } from "./core/errors.js";


export type { PolicySet, OnErrorBehavior } from "./engine/policy-set.js";
export { ApsEngine } from "./engine/aps-engine.js";
export type { ApsEngineOptions, AuditHandler } from "./engine/aps-engine.js";
