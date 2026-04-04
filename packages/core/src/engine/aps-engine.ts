import { readFile } from "node:fs/promises";
import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "../core/policy.js";
import type { InputContext } from "../generated/input-context.js";
import type { OutputContext } from "../generated/output-context.js";
import type { ToolCallContext } from "../generated/tool-call-context.js";
import type { PolicyDecision } from "../generated/policy-decision.js";
import type { PolicySet as JsonPolicySet, PolicyEntry } from "../generated/policy-set.js";
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

  static async fromJson(absolutePath: string, options?: Pick<ApsEngineOptions, "onAudit">): Promise<ApsEngine> {
    const raw = await readFile(absolutePath, "utf-8");
    const jsonPolicySet = JSON.parse(raw) as JsonPolicySet;

    const input: InputPolicy[] = [];
    const tool_call: ToolCallPolicy[] = [];
    const output: OutputPolicy[] = [];

    for (const [index, entry] of jsonPolicySet.policies.entries()) {
      const id = `policy-${index}`;
      const appliesTo = entry.applies_to as string[] | undefined;
      const appliesToAll = !appliesTo || appliesTo.length === 0;

      if (appliesToAll || appliesTo.includes("input")) {
        input.push({ id, evaluate: (ctx) => evaluateEntry(entry, ctx) });
      }

      if (appliesToAll || appliesTo.includes("tool_call")) {
        tool_call.push({
          id,
          evaluate: (ctx) => {
            const tools = entry.tools as string[] | undefined;
            if (tools && tools.length > 0 && !tools.includes(ctx.tool_name)) {
              return Promise.resolve<PolicyDecision>({ decision: "allow" });
            }
            return evaluateEntry(entry, ctx);
          },
        });
      }

      if (appliesToAll || appliesTo.includes("output")) {
        output.push({ id, evaluate: (ctx) => evaluateEntry(entry, ctx) });
      }
    }

    return new ApsEngine({ policySet: { input, tool_call, output }, ...options });
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

// ── fromJson helpers ──────────────────────────────────────────────────────────

function evaluateEntry(entry: PolicyEntry, ctx: unknown): Promise<PolicyDecision> {
  if (!evaluateCondition(entry.condition, ctx)) {
    return Promise.resolve<PolicyDecision>({ decision: "allow" });
  }
  return Promise.resolve(buildDecision(entry, ctx));
}

function evaluateCondition(condition: PolicyEntry["condition"], ctx: unknown): boolean {
  const cond = condition as unknown as Record<string, unknown>;
  if ("always" in cond) return true;
  const field = cond.field as string;
  const value = resolveField(ctx, field);
  if ("equals" in cond) return value === cond.equals;
  if ("contains" in cond) return (cond.contains as string[]).some(v => String(value).toLowerCase().includes(v.toLowerCase()));
  if ("not_in" in cond) return !(cond.not_in as unknown[]).includes(value);
  if ("greater_than" in cond) return Number(value) > (cond.greater_than as number);
  return false;
}

function resolveField(obj: unknown, fieldPath: string): unknown {
  return fieldPath.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
}

function buildDecision(entry: PolicyEntry, ctx: unknown): PolicyDecision {
  if (entry.action === "allow") return { decision: "allow" };
  if (entry.action === "deny") {
    return {
      decision: "deny",
      ...(entry.reason ? { reason: entry.reason } : {}),
    };
  }
  return {
    decision: "transform",
    transformation: {
      operations: Object.entries(entry.transformation ?? {}).map(([field, template]) => ({
        field,
        op: "set" as const,
        value: template.replace(/\{\{(.+?)\}\}/g, (_: string, expr: string) => String(resolveField(ctx, expr.trim()) ?? "")) as unknown as { [k: string]: unknown },
      })),
    },
  };
}
