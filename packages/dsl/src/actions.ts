import type { PolicyDecision, DSLPolicy, Transformation } from "@agentpolicyspecification/core";
import type { AnyContext } from "./types.js";
import { resolveField } from "./condition.js";

type ActionBuilder = (policy: DSLPolicy, ctx: AnyContext) => PolicyDecision;

export const actionBuilders: Record<DSLPolicy["action"], ActionBuilder> = {
  allow: () => ({ decision: "allow" }),
  deny: (policy) => ({ decision: "deny", ...(policy.reason && { reason: policy.reason }) }),
  transform: (policy, ctx) => ({
    decision: "transform",
    transformation: buildTransformOps(policy.transformation ?? {}, ctx),
  }),
};

function buildTransformOps(
  transformations: Record<string, string>,
  ctx: AnyContext
): Transformation {
  return {
    operations: Object.entries(transformations).map(([field, template]) => ({
      field,
      op: "set",
      value: interpolate(template, ctx),
    })),
  };
}

function interpolate(template: string, ctx: AnyContext): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_, expr: string) =>
    String(resolveField(ctx, expr.trim()) ?? "")
  );
}
