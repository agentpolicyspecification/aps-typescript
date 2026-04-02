import { trace, SpanStatusCode, type Tracer } from "@opentelemetry/api";
import type { AuditHandler } from "@agentpolicyspecification/core";

export interface OtelAuditHandlerOptions {
  /** Tracer to use. Defaults to the global tracer for 'aps'. */
  tracer?: Tracer;
}

export function createOtelAuditHandler(options: OtelAuditHandlerOptions = {}): AuditHandler {
  const tracer = options.tracer ?? trace.getTracer("aps");

  return (record) => {
    const span = tracer.startSpan("aps.policy.evaluate", {
      startTime: new Date(record.timestamp),
    });

    span.setAttributes({
      "aps.policy_id": record.policy_id ?? "unknown",
      "aps.decision": record.decision,
      "aps.interception_point": record.interception_point,
      ...(record.reason !== undefined && { "aps.reason": record.reason }),
    });

    if (record.decision === "deny" || record.decision === "evaluation_error") {
      span.setStatus({ code: SpanStatusCode.ERROR, message: record.reason ?? '' });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end(new Date(record.timestamp));
  };
}
