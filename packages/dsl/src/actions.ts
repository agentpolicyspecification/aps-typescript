import type { PolicyDecision, DSLPolicy, Transformation, AllowDecision, DenyDecision, TransformDecision, RedactDecision, AuditDecision } from "@agentpolicyspecification/core";
import type { AnyContext } from "./types.js";
import { resolveField } from "./condition.js";

type ActionBuilder = (policy: DSLPolicy, ctx: AnyContext) => PolicyDecision;

export const actionBuilders: Record<DSLPolicy["action"], ActionBuilder> = {
  allow: (): AllowDecision => ({ decision: "allow" }),
  deny: (policy): DenyDecision => ({ decision: "deny", ...(policy.reason ? { reason: policy.reason } : {}) }),
  redact: (policy): RedactDecision => ({ 
    decision: "redact", 
    redactions: policy.redactions as RedactDecision["redactions"]
  }),
  transform: (policy, ctx): TransformDecision => ({
    decision: "transform",
    transformation: buildTransformOps(policy.transformation ?? {}, ctx),
  }),
  audit: (policy): AuditDecision => ({ decision: "audit", ...(policy.reason ? { reason: policy.reason } : {}) }),
};

function buildTransformOps(
  transformations: Record<string, string>,
  ctx: AnyContext
): Transformation {
  return {
    operations: Object.entries(transformations).map(([field, template]) => ({
      field,
      op: "set" as const,
      value: interpolate(template, ctx) as unknown as { [k: string]: unknown },
    })),
  };
}

function interpolate(template: string, ctx: AnyContext): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_, expr: string) =>
    String(resolveField(ctx, expr.trim()) ?? "")
  );
}
