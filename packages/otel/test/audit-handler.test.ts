import { describe, it, expect, beforeEach } from "@jest/globals";
import { trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { SpanStatusCode } from "@opentelemetry/api";
import { createOtelAuditHandler } from "../src/audit-handler.js";
import type { AuditRecord } from "@agentpolicyspecification/core";

// ─── Test tracer setup ────────────────────────────────────────────────────────

let exporter: InMemorySpanExporter;
let tracer: ReturnType<typeof trace.getTracer>;

beforeEach(() => {
  exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [exporter] });
  tracer = provider.getTracer("aps-test");
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
      metadata: { agent_id: "a1", session_id: "s1", timestamp: "2026-01-01T00:00:00Z" },
    },
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createOtelAuditHandler", () => {
  it("creates a span named aps.policy.evaluate", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record());
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe("aps.policy.evaluate");
  });

  it("sets aps.policy_id, aps.decision and aps.interception_point attributes", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ policy_id: "my-policy", decision: "deny", interception_point: "tool_call" }));
    const attrs = exporter.getFinishedSpans()[0]!.attributes;
    expect(attrs["aps.policy_id"]).toBe("my-policy");
    expect(attrs["aps.decision"]).toBe("deny");
    expect(attrs["aps.interception_point"]).toBe("tool_call");
  });

  it("sets aps.reason when present", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ decision: "deny", reason: "Blocked content." }));
    const attrs = exporter.getFinishedSpans()[0]!.attributes;
    expect(attrs["aps.reason"]).toBe("Blocked content.");
  });

  it("omits aps.reason when not present", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ decision: "allow", reason: undefined }));
    const attrs = exporter.getFinishedSpans()[0]!.attributes;
    expect(attrs["aps.reason"]).toBeUndefined();
  });

  it("sets status OK for allow", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ decision: "allow" }));
    expect(exporter.getFinishedSpans()[0]!.status.code).toBe(SpanStatusCode.OK);
  });

  it("sets status ERROR for deny", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ decision: "deny", reason: "Not allowed." }));
    const span = exporter.getFinishedSpans()[0]!;
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toBe("Not allowed.");
  });

  it("sets status ERROR for evaluation_error", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ decision: "evaluation_error", reason: "Timeout." }));
    expect(exporter.getFinishedSpans()[0]!.status.code).toBe(SpanStatusCode.ERROR);
  });

  it("sets status OK for audit decision", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ decision: "audit", reason: "Logged for review." }));
    expect(exporter.getFinishedSpans()[0]!.status.code).toBe(SpanStatusCode.OK);
  });

  it("falls back to 'unknown' for missing policy_id", () => {
    const handler = createOtelAuditHandler({ tracer });
    handler(record({ policy_id: undefined }));
    expect(exporter.getFinishedSpans()[0]!.attributes["aps.policy_id"]).toBe("unknown");
  });

  it("uses the global tracer when no tracer is provided", () => {
    const globalExporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({ spanProcessors: [globalExporter] });
    provider.register();

    const handler = createOtelAuditHandler();
    handler(record());
    expect(globalExporter.getFinishedSpans()).toHaveLength(1);
  });
});
