import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "../core/policy.js";
import type { InputContext } from "../generated/input-context.js";
import type { OutputContext } from "../generated/output-context.js";
import type { ToolCallContext } from "../generated/tool-call-context.js";
import type { PolicyDecision } from "../generated/policy-decision.js";
import { AuditRecord, InterceptionPoint, PolicyDenialError, PolicyEvaluationError } from "../core/errors.js";
import type { PolicySet } from "./policy-set.js";

export type AuditHandler = (record: AuditRecord) => void | Promise<void>;

export interface ApsEngineOptions {
  policySet: PolicySet;
  onAudit?: AuditHandler;
}

export class ApsEngine {
  private readonly policySet: PolicySet;
  private readonly onAudit: AuditHandler | undefined;

  constructor({ policySet, onAudit }: ApsEngineOptions) {
    this.policySet = policySet;
    this.onAudit = onAudit;
  }

  async evaluateInput(context: InputContext): Promise<void> {
    await this.runPolicies(this.policySet.input ?? [], context, "input");
  }

  async evaluateToolCall(context: ToolCallContext): Promise<void> {
    await this.runPolicies(this.policySet.tool_call ?? [], context, "tool_call");
  }

  async evaluateOutput(context: OutputContext): Promise<void> {
    await this.runPolicies(this.policySet.output ?? [], context, "output");
  }

  private async runPolicies(policies: InputPolicy[], context: InputContext, interceptionPoint: "input"): Promise<void>;
  private async runPolicies(policies: ToolCallPolicy[], context: ToolCallContext, interceptionPoint: "tool_call"): Promise<void>;
  private async runPolicies(policies: OutputPolicy[], context: OutputContext, interceptionPoint: "output"): Promise<void>;
  private async runPolicies(
    policies: (InputPolicy | ToolCallPolicy | OutputPolicy)[],
    context: InputContext | ToolCallContext | OutputContext,
    interceptionPoint: InterceptionPoint
  ): Promise<void> {
    for (const policy of policies) {
      let decision: PolicyDecision;

      try {
        decision = await (policy as { evaluate(ctx: typeof context): Promise<PolicyDecision> | PolicyDecision }).evaluate(context);
      } catch (err) {
        console.error('err: ', err);
        if (err instanceof PolicyEvaluationError) {
          await this.audit({
            policy_id: policy.id,
            decision: "evaluation_error",
            interception_point: interceptionPoint,
            reason: String(err.cause),
            context,
            timestamp: new Date().toISOString(),
          });
        }

        if ((this.policySet.on_error ?? "deny") === "deny") {
          throw err instanceof PolicyEvaluationError
            ? err
            : new PolicyEvaluationError({ policy_id: policy.id, interception_point: interceptionPoint, cause: err });
        }

        continue;
      }

      if (decision.decision === "audit") {
        await this.audit({
          policy_id: policy.id,
          decision: "audit",
          interception_point: interceptionPoint,
          reason: decision.reason,
          context,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      if (decision.decision === "deny") {
        await this.audit({
          policy_id: policy.id,
          decision: "deny",
          interception_point: interceptionPoint,
          reason: decision.reason,
          context,
          timestamp: new Date().toISOString(),
        });

        throw new PolicyDenialError({
          policy_id: decision.policy_id ?? policy.id,
          interception_point: interceptionPoint,
          reason: decision.reason ?? "Policy denied without reason",
        });
      }

      // allow, redact, transform — log and continue
      // (redact/transform mutation is left to the runtime adapter layer)
      if (decision.decision !== "allow") {
        await this.audit({
          policy_id: policy.id,
          decision: decision.decision,
          interception_point: interceptionPoint,
          reason: undefined,
          context,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private async audit(record: AuditRecord): Promise<void> {
    if (this.onAudit) {
      await this.onAudit(record);
    }
  }
}
