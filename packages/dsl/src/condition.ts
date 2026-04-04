import type { AnyContext, Condition } from "./types.js";

type ConditionOperators = {
  equals(value: unknown, operand: unknown): boolean;
  contains(value: unknown, operand: string[]): boolean;
  not_in(value: unknown, operand: unknown[]): boolean;
  greater_than(value: unknown, operand: number): boolean;
};

const conditionOps: ConditionOperators = {
  equals:       (value, operand) => value === operand,
  contains:     (value, operand) => operand.some(v => String(value).toLowerCase().includes(v.toLowerCase())),
  not_in:       (value, operand) => !operand.includes(value),
  greater_than: (value, operand) => Number(value) > operand,
};

export function evaluateCondition(condition: Condition, ctx: AnyContext): boolean {
  if ("always" in condition) return true;

  const cond = condition as any;
  const value = resolveField(ctx, cond.field);

  for (const [op, fn] of Object.entries(conditionOps) as [keyof ConditionOperators, ConditionOperators[keyof ConditionOperators]][]) {
    if (op in cond) {
      return (fn as (v: unknown, o: unknown) => boolean)(value, cond[op]);
    }
  }

  return false;
}

export function resolveField(obj: unknown, fieldPath: string): unknown {
  return fieldPath.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
}
