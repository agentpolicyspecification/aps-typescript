import { describe, it, expect } from "@jest/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { InputContext, ToolCallContext, OutputContext } from "@agentpolicyspecification/core";
import { DslInputPolicy, DslToolCallPolicy, DslOutputPolicy } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

function inputCtx(content: string): InputContext {
  return {
    messages: [{ role: "user", content }],
    metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
  };
}

function toolCallCtx(tool_name: string): ToolCallContext {
  return {
    tool_name,
    arguments: {},
    calling_message: { role: "assistant", content: "calling tool" },
    metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
  };
}

function outputCtx(content: string): OutputContext {
  return {
    response: { role: "assistant", content },
    metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
  };
}

// ─── DslInputPolicy ───────────────────────────────────────────────────────────

describe("DslInputPolicy", () => {
  const policy = new DslInputPolicy("allow-policy", FIXTURES_DIR);

  it("allows when condition matches and action is allow", async () => {
    const result = await policy.evaluate(inputCtx("hello world"));
    expect(result.decision).toBe("allow");
  });

  it("falls through to allow when condition does not match", async () => {
    const result = await policy.evaluate(inputCtx("goodbye world"));
    expect(result.decision).toBe("allow");
  });
});

// ─── DslToolCallPolicy ────────────────────────────────────────────────────────

describe("DslToolCallPolicy", () => {
  const policy = new DslToolCallPolicy("tool", FIXTURES_DIR);

  it("denies a blocked tool call", async () => {
    const result = await policy.evaluate(toolCallCtx("deleteAllUsers"));
    expect(result.decision).toBe("deny");
  });

  it("allows an unblocked tool call", async () => {
    const result = await policy.evaluate(toolCallCtx("web_search"));
    expect(result.decision).toBe("allow");
  });
});

// ─── DslOutputPolicy — deny ───────────────────────────────────────────────────

describe("DslOutputPolicy — deny", () => {
  const policy = new DslOutputPolicy("deny-policy", FIXTURES_DIR);

  it("denies when response contains blocked word", async () => {
    const result = await policy.evaluate(outputCtx("my password is 1234"));
    expect(result.decision).toBe("deny");
  });

  it("allows a clean response", async () => {
    const result = await policy.evaluate(outputCtx("The weather is sunny."));
    expect(result.decision).toBe("allow");
  });
});

// ─── DslOutputPolicy — transform ─────────────────────────────────────────────

describe("DslOutputPolicy — transform", () => {
  const policy = new DslOutputPolicy("transform-policy", FIXTURES_DIR);

  it("applies transformation with interpolation", async () => {
    const result = await policy.evaluate(outputCtx("hello there"));
    expect(result.decision).toBe("transform");
    expect((result as any).transformation.operations).toEqual([
      { field: "response.content", op: "set", value: "Hi a1" },
    ]);
  });

  it("does not transform when condition does not match", async () => {
    const result = await policy.evaluate(outputCtx("goodbye there"));
    expect(result.decision).toBe("allow");
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  it("throws PolicyEvaluationError on missing policy file", async () => {
    const policy = new DslOutputPolicy("missing", FIXTURES_DIR);
    await expect(
      policy.evaluate(outputCtx("hello"))
    ).rejects.toThrow("Policy evaluation failed for 'missing' at 'output'.");
  });
});
