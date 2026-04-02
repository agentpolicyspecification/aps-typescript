import { describe, it, expect } from "@jest/globals";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { ApsEngine } from "@agentpolicyspecification/core";
import { PolicyDenialError } from "@agentpolicyspecification/core";
import { RegoInputPolicy, RegoToolCallPolicy, RegoOutputPolicy } from "../src/rego-policy.js";
import type { InputContext, ToolCallContext, OutputContext } from "@agentpolicyspecification/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = join(__dirname, "fixtures/wasm");

function bundle(name: string) {
  return join(WASM_DIR, `${name}.tar.gz`);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

// ─── no-ssn-input ─────────────────────────────────────────────────────────────

describe("RegoInputPolicy — no-ssn-input", () => {
  const policy = new RegoInputPolicy("no-ssn", bundle("no-ssn-input"));

  it("allows a clean message", async () => {
    const decision = await policy.evaluate(inputCtx("What is the weather today?"));
    expect(decision.decision).toBe("allow");
  });

  it("denies a message containing an SSN", async () => {
    const decision = await policy.evaluate(inputCtx("My SSN is 123-45-6789"));
    expect(decision.decision).toBe("deny");
  });

  it("includes a reason on denial", async () => {
    const decision = await policy.evaluate(inputCtx("SSN: 123-45-6789"));
    expect(decision.decision).toBe("deny");
    expect((decision as any).reason).toBe("Message contains a potential SSN.");
  });

  it("integrates with ApsEngine to block SSN input", async () => {
    const engine = new ApsEngine({
      policySet: { input: [policy] },
    });
    await expect(
      engine.evaluateInput(inputCtx("Please store 123-45-6789 for me."))
    ).rejects.toThrow(PolicyDenialError);
  });

  it("integrates with ApsEngine to pass clean input", async () => {
    const engine = new ApsEngine({
      policySet: { input: [policy] },
    });
    await expect(
      engine.evaluateInput(inputCtx("Tell me a joke."))
    ).resolves.toBeUndefined();
  });
});

// ─── approved-tools ───────────────────────────────────────────────────────────

describe("RegoToolCallPolicy — approved-tools", () => {
  const policy = new RegoToolCallPolicy("approved-tools", bundle("approved-tools"));

  it("allows an approved tool", async () => {
    const decision = await policy.evaluate(toolCallCtx("web_search"));
    expect(decision.decision).toBe("allow");
  });

  it("denies an unapproved tool", async () => {
    const decision = await policy.evaluate(toolCallCtx("delete_file"));
    expect(decision.decision).toBe("deny");
  });

  it("denies all unapproved tools", async () => {
    const unapproved = ["exec_command", "write_file", "send_email"];
    for (const tool of unapproved) {
      const decision = await policy.evaluate(toolCallCtx(tool));
      expect(decision.decision).toBe("deny");
    }
  });

  it("integrates with ApsEngine to block unapproved tools", async () => {
    const engine = new ApsEngine({
      policySet: { tool_call: [policy] },
    });
    await expect(
      engine.evaluateToolCall(toolCallCtx("exec_command"))
    ).rejects.toThrow(PolicyDenialError);
  });
});

// ─── no-blocked-domain-output ─────────────────────────────────────────────────

describe("RegoOutputPolicy — no-blocked-domain-output", () => {
  const policy = new RegoOutputPolicy("no-blocked-domain", bundle("no-blocked-domain-output"));

  it("allows a clean response", async () => {
    const decision = await policy.evaluate(outputCtx("The weather in Amsterdam is 15°C."));
    expect(decision.decision).toBe("allow");
  });

  it("denies a response containing a blocked domain", async () => {
    const decision = await policy.evaluate(outputCtx("Visit malicious.example for more info."));
    expect(decision.decision).toBe("deny");
  });

  it("integrates with ApsEngine to block unsafe output", async () => {
    const engine = new ApsEngine({
      policySet: { output: [policy] },
    });
    await expect(
      engine.evaluateOutput(outputCtx("Click here: phishing.example"))
    ).rejects.toThrow(PolicyDenialError);
  });
});
