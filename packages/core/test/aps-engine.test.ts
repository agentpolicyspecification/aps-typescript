import { jest, describe, it, expect } from "@jest/globals";
import { ApsEngine } from "../src/engine/aps-engine.js";
import { PolicyDenialError, PolicyEvaluationError } from "../src/core/errors.js";
import type { AuditRecord } from "../src/core/errors.js";
import type { InputPolicy, ToolCallPolicy, OutputPolicy } from "../src/core/policy.js";
import { InputContext } from "../src/generated/input-context.js";
import { ToolCallContext } from "../src/generated/tool-call-context.js";
import { OutputContext } from "../src/generated/output-context.js";
import { PolicyDecision } from "../src/generated/policy-decision.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const inputCtx: InputContext = {
  messages: [{ role: "user", content: "hello" }],
  metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
};

const toolCallCtx: ToolCallContext = {
  tool_name: "read_file",
  arguments: { path: "/data.txt" },
  calling_message: { role: "assistant", content: "I will read the file." },
  metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
};

const outputCtx: OutputContext = {
  response: { role: "assistant", content: "Here is the result." },
  metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
};

function makeInputPolicy(id: string, decision: PolicyDecision): InputPolicy {
  return { id, evaluate: () => decision };
}

function makeToolCallPolicy(id: string, decision: PolicyDecision): ToolCallPolicy {
  return { id, evaluate: () => decision };
}

function makeOutputPolicy(id: string, decision: PolicyDecision): OutputPolicy {
  return { id, evaluate: () => decision };
}

// ─── evaluateInput ────────────────────────────────────────────────────────────

describe("ApsEngine.evaluateInput", () => {
  it("resolves when all input policies allow", async () => {
    const engine = new ApsEngine({
      policySet: {
        input: [
          makeInputPolicy("p1", { decision: "allow" }),
          makeInputPolicy("p2", { decision: "allow" }),
        ],
      },
    });
    await expect(engine.evaluateInput(inputCtx)).resolves.toBeUndefined();
  });

  it("throws PolicyDenialError when a policy denies", async () => {
    const engine = new ApsEngine({
      policySet: {
        input: [makeInputPolicy("deny-policy", { decision: "deny", reason: "Not allowed" })],
      },
    });
    await expect(engine.evaluateInput(inputCtx)).rejects.toThrow(PolicyDenialError);
  });

  it("sets the correct interception_point on denial", async () => {
    const engine = new ApsEngine({
      policySet: { input: [makeInputPolicy("p", { decision: "deny" })] },
    });
    try {
      await engine.evaluateInput(inputCtx);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyDenialError);
      expect((err as PolicyDenialError).interception_point).toBe("input");
    }
  });

  it("stops evaluating after the first deny", async () => {
    const secondPolicy: InputPolicy = {
      id: "second",
      evaluate: jest.fn(() => ({ decision: "allow" as const })),
    };
    const engine = new ApsEngine({
      policySet: {
        input: [
          makeInputPolicy("deny", { decision: "deny" }),
          secondPolicy,
        ],
      },
    });
    await expect(engine.evaluateInput(inputCtx)).rejects.toThrow(PolicyDenialError);
    expect(secondPolicy.evaluate).not.toHaveBeenCalled();
  });

  it("resolves with no input policies configured", async () => {
    const engine = new ApsEngine({ policySet: {} });
    await expect(engine.evaluateInput(inputCtx)).resolves.toBeUndefined();
  });
});

// ─── evaluateToolCall ─────────────────────────────────────────────────────────

describe("ApsEngine.evaluateToolCall", () => {
  it("resolves when the tool call is allowed", async () => {
    const engine = new ApsEngine({
      policySet: { tool_call: [makeToolCallPolicy("p", { decision: "allow" })] },
    });
    await expect(engine.evaluateToolCall(toolCallCtx)).resolves.toBeUndefined();
  });

  it("throws PolicyDenialError when the tool call is denied", async () => {
    const engine = new ApsEngine({
      policySet: {
        tool_call: [
          makeToolCallPolicy("block-tool", { decision: "deny", reason: "Tool not permitted" }),
        ],
      },
    });
    await expect(engine.evaluateToolCall(toolCallCtx)).rejects.toThrow(PolicyDenialError);
  });

  it("sets interception_point to tool_call on denial", async () => {
    const engine = new ApsEngine({
      policySet: { tool_call: [makeToolCallPolicy("p", { decision: "deny" })] },
    });
    try {
      await engine.evaluateToolCall(toolCallCtx);
    } catch (err) {
      expect((err as PolicyDenialError).interception_point).toBe("tool_call");
    }
  });
});

// ─── evaluateOutput ───────────────────────────────────────────────────────────

describe("ApsEngine.evaluateOutput", () => {
  it("resolves when output policy allows", async () => {
    const engine = new ApsEngine({
      policySet: { output: [makeOutputPolicy("p", { decision: "allow" })] },
    });
    await expect(engine.evaluateOutput(outputCtx)).resolves.toBeUndefined();
  });

  it("throws PolicyDenialError when output is denied", async () => {
    const engine = new ApsEngine({
      policySet: {
        output: [makeOutputPolicy("block-output", { decision: "deny", reason: "Unsafe content" })],
      },
    });
    await expect(engine.evaluateOutput(outputCtx)).rejects.toThrow(PolicyDenialError);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe("ApsEngine audit", () => {
  it("calls onAudit for audit decisions and continues", async () => {
    const auditRecords: AuditRecord[] = [];
    const engine = new ApsEngine({
      policySet: {
        input: [
          makeInputPolicy("audit-policy", { decision: "audit", reason: "Logging" }),
          makeInputPolicy("allow-policy", { decision: "allow" }),
        ],
      },
      onAudit: record => { auditRecords.push(record); },
    });

    await engine.evaluateInput(inputCtx);

    expect(auditRecords).toHaveLength(1);
    expect(auditRecords[0]!.decision).toBe("audit");
    expect(auditRecords[0]!.policy_id).toBe("audit-policy");
    expect(auditRecords[0]!.interception_point).toBe("input");
  });

  it("calls onAudit when a policy denies", async () => {
    const auditRecords: AuditRecord[] = [];
    const engine = new ApsEngine({
      policySet: {
        input: [makeInputPolicy("deny-policy", { decision: "deny", reason: "Blocked" })],
      },
      onAudit: record => { auditRecords.push(record); },
    });

    await expect(engine.evaluateInput(inputCtx)).rejects.toThrow(PolicyDenialError);
    expect(auditRecords).toHaveLength(1);
    expect(auditRecords[0]!.decision).toBe("deny");
  });

  it("calls onAudit for redact decisions and continues", async () => {
    const auditRecords: AuditRecord[] = [];
    const engine = new ApsEngine({
      policySet: {
        input: [
          makeInputPolicy("redact-policy", {
            decision: "redact",
            redactions: [{ field: "messages[0].content", strategy: "mask", replacement: "[REDACTED]" }],
          }),
        ],
      },
      onAudit: record => { auditRecords.push(record); },
    });

    await engine.evaluateInput(inputCtx);

    expect(auditRecords).toHaveLength(1);
    expect(auditRecords[0]!.decision).toBe("redact");
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("ApsEngine error handling", () => {
  it("throws PolicyEvaluationError when a policy throws (on_error: deny)", async () => {
    const brokenPolicy: InputPolicy = {
      id: "broken",
      evaluate: () => { throw new Error("Internal failure"); },
    };
    const engine = new ApsEngine({
      policySet: { on_error: "deny", input: [brokenPolicy] },
    });
    await expect(engine.evaluateInput(inputCtx)).rejects.toThrow(PolicyEvaluationError);
  });

  it("continues when a policy throws and on_error is allow", async () => {
    const brokenPolicy: InputPolicy = {
      id: "broken",
      evaluate: () => { throw new Error("Internal failure"); },
    };
    const engine = new ApsEngine({
      policySet: { on_error: "allow", input: [brokenPolicy] },
    });
    await expect(engine.evaluateInput(inputCtx)).resolves.toBeUndefined();
  });

  it("defaults to deny when on_error is not set and a policy throws", async () => {
    const brokenPolicy: InputPolicy = {
      id: "broken",
      evaluate: () => { throw new Error("Internal failure"); },
    };
    const engine = new ApsEngine({
      policySet: { input: [brokenPolicy] },
    });
    await expect(engine.evaluateInput(inputCtx)).rejects.toThrow(PolicyEvaluationError);
  });

  it("sets the correct policy_id on PolicyEvaluationError", async () => {
    const engine = new ApsEngine({
      policySet: {
        input: [{
          id: "my-failing-policy",
          evaluate: () => { throw new Error("boom"); },
        }],
      },
    });
    try {
      await engine.evaluateInput(inputCtx);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyEvaluationError);
      expect((err as PolicyEvaluationError).policy_id).toBe("my-failing-policy");
    }
  });
});
