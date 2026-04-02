import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { SpanStatusCode } from "@opentelemetry/api";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import type { AuditHandler } from "@agentpolicyspecification/core";

export interface LangfuseAuditHandlerOptions {
  /** Langfuse public key. Defaults to LANGFUSE_PUBLIC_KEY env var. */
  publicKey?: string;
  /** Langfuse secret key. Defaults to LANGFUSE_SECRET_KEY env var. */
  secretKey?: string;
  /** Langfuse base URL. Defaults to LANGFUSE_BASE_URL env var or https://cloud.langfuse.com. */
  baseUrl?: string;
}

export interface LangfuseAuditHandler extends AuditHandler {
  flush(): Promise<void>;
}

export function createLangfuseAuditHandler(options: LangfuseAuditHandlerOptions = {}): LangfuseAuditHandler {
  const provider = new BasicTracerProvider({
    spanProcessors: [
      new LangfuseSpanProcessor(options),
    ],
  });

  const tracer = provider.getTracer("aps");

  const handler: LangfuseAuditHandler = (record) => {
    const metadata = (record.context as { metadata?: { session_id?: string; agent_id?: string } }).metadata;
    const startTime = new Date(record.timestamp);
    const endTime = new Date(startTime.getTime() + 1);

    const span = tracer.startSpan("aps.policy.evaluate", { startTime });

    span.setAttributes({
      "aps.policy_id": record.policy_id ?? "unknown",
      "aps.decision": record.decision,
      "aps.interception_point": record.interception_point,
      ...(record.reason !== undefined && { "aps.reason": record.reason }),
      ...(metadata?.session_id !== undefined && { "session.id": metadata.session_id }),
      ...(metadata?.agent_id !== undefined && { "user.id": metadata.agent_id }),
    });

    if (record.decision === "deny" || record.decision === "evaluation_error") {
      span.setStatus({ code: SpanStatusCode.ERROR, message: record.reason ?? "" });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end(endTime);
  };

  handler.flush = () => provider.forceFlush();

  return handler;
}
