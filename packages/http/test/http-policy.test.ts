import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { ApsEngine, PolicyDenialError, PolicyEvaluationError } from "@agentpolicyspecification/core";
import { HttpInputPolicy, HttpToolCallPolicy, HttpOutputPolicy } from "../src/http-policy.js";
import type { InputContext, ToolCallContext, OutputContext, PolicyDecision } from "@agentpolicyspecification/core";

// ─── Mock server ──────────────────────────────────────────────────────────────

type Handler = (body: unknown) => { status: number; body: unknown };

let handler: Handler = () => ({ status: 200, body: { decision: "allow" } });

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  let raw = "";
  req.on("data", (chunk) => { raw += chunk; });
  req.on("end", () => {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const { status, body } = handler(parsed);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
});

let baseUrl: string;

beforeAll(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => {
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
  resolve();
})));

afterAll(() => new Promise<void>((resolve, reject) =>
  server.close((err) => err ? reject(err) : resolve())
));

beforeEach(() => {
  handler = () => ({ status: 200, body: { decision: "allow" } });
});

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

// ─── HttpInputPolicy ──────────────────────────────────────────────────────────

describe("HttpInputPolicy", () => {
  it("returns the decision from the remote server", async () => {
    handler = () => ({ status: 200, body: { decision: "allow" } });
    const policy = new HttpInputPolicy("test-input", { baseUrl });
    const decision = await policy.evaluate(inputCtx("hello"));
    expect(decision.decision).toBe("allow");
  });

  it("returns a deny decision with reason", async () => {
    handler = () => ({ status: 200, body: { decision: "deny", reason: "Blocked content." } });
    const policy = new HttpInputPolicy("test-input", { baseUrl });
    const decision = await policy.evaluate(inputCtx("bad content")) as { decision: string; reason: string };
    expect(decision.decision).toBe("deny");
    expect(decision.reason).toBe("Blocked content.");
  });

  it("sends policy_id, interception_point and context in the request body", async () => {
    let received: unknown;
    handler = (body) => { received = body; return { status: 200, body: { decision: "allow" } }; };
    const policy = new HttpInputPolicy("my-policy", { baseUrl });
    await policy.evaluate(inputCtx("hello"));
    expect(received).toMatchObject({
      policy_id: "my-policy",
      interception_point: "input",
      context: { messages: [{ role: "user", content: "hello" }] },
    });
  });

  it("throws PolicyEvaluationError on non-200 response", async () => {
    handler = () => ({ status: 500, body: { error: "internal error" } });
    const policy = new HttpInputPolicy("test-input", { baseUrl });
    await expect(policy.evaluate(inputCtx("hello"))).rejects.toThrow(PolicyEvaluationError);
  });

  it("throws PolicyEvaluationError on invalid JSON response", async () => {
    const server2 = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("not-json");
    });
    await new Promise<void>((resolve) => server2.listen(0, "127.0.0.1", resolve));
    const { port } = server2.address() as { port: number };
    const policy = new HttpInputPolicy("test-input", { baseUrl: `http://127.0.0.1:${port}` });
    await expect(policy.evaluate(inputCtx("hello"))).rejects.toThrow(PolicyEvaluationError);
    await new Promise<void>((resolve, reject) => server2.close((e) => e ? reject(e) : resolve()));
  });

  it("integrates with ApsEngine — passes when allowed", async () => {
    handler = () => ({ status: 200, body: { decision: "allow" } });
    const engine = new ApsEngine({ policySet: { input: [new HttpInputPolicy("p", { baseUrl })] } });
    await expect(engine.evaluateInput(inputCtx("hello"))).resolves.toBeUndefined();
  });

  it("integrates with ApsEngine — throws PolicyDenialError when denied", async () => {
    handler = () => ({ status: 200, body: { decision: "deny", reason: "Not allowed." } });
    const engine = new ApsEngine({ policySet: { input: [new HttpInputPolicy("p", { baseUrl })] } });
    await expect(engine.evaluateInput(inputCtx("hello"))).rejects.toThrow(PolicyDenialError);
  });
});

// ─── HttpToolCallPolicy ───────────────────────────────────────────────────────

describe("HttpToolCallPolicy", () => {
  it("returns the decision from the remote server", async () => {
    handler = () => ({ status: 200, body: { decision: "allow" } });
    const policy = new HttpToolCallPolicy("test-tool", { baseUrl });
    const decision = await policy.evaluate(toolCallCtx("web_search"));
    expect(decision.decision).toBe("allow");
  });

  it("sends interception_point as tool_call", async () => {
    let received: unknown;
    handler = (body) => { received = body; return { status: 200, body: { decision: "allow" } }; };
    const policy = new HttpToolCallPolicy("test-tool", { baseUrl });
    await policy.evaluate(toolCallCtx("web_search"));
    expect(received).toMatchObject({ interception_point: "tool_call" });
  });

  it("returns a deny decision", async () => {
    handler = () => ({ status: 200, body: { decision: "deny" } });
    const policy = new HttpToolCallPolicy("test-tool", { baseUrl });
    const decision = await policy.evaluate(toolCallCtx("delete_file"));
    expect(decision.decision).toBe("deny");
  });

  it("throws PolicyEvaluationError on non-200 response", async () => {
    handler = () => ({ status: 403, body: {} });
    const policy = new HttpToolCallPolicy("test-tool", { baseUrl });
    await expect(policy.evaluate(toolCallCtx("exec"))).rejects.toThrow(PolicyEvaluationError);
  });
});

// ─── HttpOutputPolicy ─────────────────────────────────────────────────────────

describe("HttpOutputPolicy", () => {
  it("returns the decision from the remote server", async () => {
    handler = () => ({ status: 200, body: { decision: "allow" } });
    const policy = new HttpOutputPolicy("test-output", { baseUrl });
    const decision = await policy.evaluate(outputCtx("The weather is nice."));
    expect(decision.decision).toBe("allow");
  });

  it("sends interception_point as output", async () => {
    let received: unknown;
    handler = (body) => { received = body; return { status: 200, body: { decision: "allow" } }; };
    const policy = new HttpOutputPolicy("test-output", { baseUrl });
    await policy.evaluate(outputCtx("hello"));
    expect(received).toMatchObject({ interception_point: "output" });
  });

  it("returns a deny decision for blocked content", async () => {
    handler = () => ({ status: 200, body: { decision: "deny", reason: "Blocked domain." } });
    const policy = new HttpOutputPolicy("test-output", { baseUrl });
    const decision = await policy.evaluate(outputCtx("Visit evil.example")) as PolicyDecision & { reason?: string };
    expect(decision.decision).toBe("deny");
  });

  it("integrates with ApsEngine — throws PolicyDenialError when denied", async () => {
    handler = () => ({ status: 200, body: { decision: "deny" } });
    const engine = new ApsEngine({ policySet: { output: [new HttpOutputPolicy("p", { baseUrl })] } });
    await expect(engine.evaluateOutput(outputCtx("blocked"))).rejects.toThrow(PolicyDenialError);
  });
});
