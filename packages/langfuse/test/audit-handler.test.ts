import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { SpanStatusCode } from "@opentelemetry/api";
import type { AuditRecord } from "@agentpolicyspecification/core";

// ─── Mock @langfuse/otel ──────────────────────────────────────────────────────
// LangfuseSpanProcessor is replaced with InMemorySpanExporter so no real
// network calls are made. The test verifies span shape only.

let exporter: InMemorySpanExporter;

jest.mock("@langfuse/otel", () => ({
  LangfuseSpanProcessor: jest.fn().mockImplementation(() => exporter),
}));

// Import after mock is registered
const { createLangfuseAuditHandler } = await import("../src/audit-handler.js");

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  exporter = new InMemorySpanExporter();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    policy_id: "test-policy",
    decision: "allow",
    interception_point: "input",
    reason: undefined,
    context: {
      messages: [{ role: "user", content: "hello" }],
      metadata: { agent_id: "agent-1", session_id: "session-1", timestamp: "2026-01-01T00:00:00Z" },
    },
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createLangfuseAuditHandler", () => {
  it("creates a span named aps.policy.evaluate", () => {
    const handler = createLangfuseAuditHandler();
    handler(record());
    expect(exporter.getFinishedSpans()[0]!.name).toBe("aps.policy.evaluate");
  });

  it("sets core aps.* attributes", () => {
    const handler = createLangfuseAuditHandler();
    handler(record({ policy_id: "my-policy", decision: "deny", interception_point: "tool_call" }));
    const attrs = exporter.getFinishedSpans()[0]!.attributes;
    expect(attrs["aps.policy_id"]).toBe("my-policy");
    expect(attrs["aps.decision"]).toBe("deny");
    expect(attrs["aps.interception_point"]).toBe("tool_call");
  });

  it("sets session.id from context metadata", () => {
    const handler = createLangfuseAuditHandler();
    handler(record());
    expect(exporter.getFinishedSpans()[0]!.attributes["session.id"]).toBe("session-1");
  });

  it("sets user.id from context metadata agent_id", () => {
    const handler = createLangfuseAuditHandler();
    handler(record());
    expect(exporter.getFinishedSpans()[0]!.attributes["user.id"]).toBe("agent-1");
  });

  it("sets aps.reason when present", () => {
    const handler = createLangfuseAuditHandler();
    handler(record({ decision: "deny", reason: "Blocked content." }));
    expect(exporter.getFinishedSpans()[0]!.attributes["aps.reason"]).toBe("Blocked content.");
  });

  it("omits aps.reason when not present", () => {
    const handler = createLangfuseAuditHandler();
    handler(record());
    expect(exporter.getFinishedSpans()[0]!.attributes["aps.reason"]).toBeUndefined();
  });

  it("sets status OK for allow", () => {
    const handler = createLangfuseAuditHandler();
    handler(record({ decision: "allow" }));
    expect(exporter.getFinishedSpans()[0]!.status.code).toBe(SpanStatusCode.OK);
  });

  it("sets status ERROR for deny", () => {
    const handler = createLangfuseAuditHandler();
    handler(record({ decision: "deny", reason: "Not allowed." }));
    const span = exporter.getFinishedSpans()[0]!;
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toBe("Not allowed.");
  });

  it("sets status ERROR for evaluation_error", () => {
    const handler = createLangfuseAuditHandler();
    handler(record({ decision: "evaluation_error" }));
    expect(exporter.getFinishedSpans()[0]!.status.code).toBe(SpanStatusCode.ERROR);
  });

  it("falls back to 'unknown' for missing policy_id", () => {
    const handler = createLangfuseAuditHandler();
    handler(record({ policy_id: undefined }));
    expect(exporter.getFinishedSpans()[0]!.attributes["aps.policy_id"]).toBe("unknown");
  });
});
