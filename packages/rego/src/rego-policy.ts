import { loadPolicy } from "@open-policy-agent/opa-wasm";
import { readFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { Writable } from "node:stream";
import { Parser } from "tar";
import type { InputPolicy, OutputPolicy, ToolCallPolicy } from "@agentpolicyspecification/core";
import type { InputContext, OutputContext, PolicyDecision, ToolCallContext } from "@agentpolicyspecification/core";
import { PolicyEvaluationError } from "@agentpolicyspecification/core";

type AnyContext = InputContext | ToolCallContext | OutputContext;

async function loadWasm(bundlePath: string): Promise<Buffer> {
  if (bundlePath.endsWith(".tar.gz")) {
    return extractWasmFromBundle(bundlePath);
  }
  return readFile(bundlePath);
}

function extractWasmFromBundle(bundlePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const extract = new Parser({
      filter: (path: string) => path === "/policy.wasm" || path === "policy.wasm",
    });

    extract.on("entry", (entry: NodeJS.ReadableStream & { path: string }) => {
      const writable = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk as Buffer);
          cb();
        },
      });
      entry.pipe(writable);
      writable.on("finish", () => resolve(Buffer.concat(chunks)));
    });

    extract.on("error", reject);
    extract.on("end", () => {
      if (chunks.length === 0) reject(new Error("policy.wasm not found in bundle"));
    });

    const source = createReadStream(bundlePath);
    const gunzip = createGunzip();
    source.on("error", reject);
    gunzip.on("error", reject);
    source.pipe(gunzip).pipe(extract);
  });
}

async function evaluate(
  id: string,
  bundlePath: string,
  context: AnyContext,
  interceptionPoint: "input" | "tool_call" | "output"
): Promise<PolicyDecision> {
  let policy;

  try {
    const bytes = await loadWasm(bundlePath);
    policy = await loadPolicy(bytes);
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  let result;
  try {
    result = policy.evaluate(context);
  } catch (cause) {
    throw new PolicyEvaluationError({ policy_id: id, interception_point: interceptionPoint, cause });
  }

  const decision = result?.[0]?.result?.decision;
  if (!decision) {
    throw new PolicyEvaluationError({
      policy_id: id,
      interception_point: interceptionPoint,
      cause: new Error("Policy produced no decision."),
    });
  }

  return {
    decision,
    ...(result[0].result.reason && { reason: result[0].result.reason }),
    ...(result[0].result.redactions && { redactions: result[0].result.redactions }),
    ...(result[0].result.transformation && { transformation: result[0].result.transformation }),
  } as PolicyDecision;
}

// ─── Typed wrappers per interception point ────────────────────────────────────

export class RegoInputPolicy implements InputPolicy {
  constructor(
    readonly id: string,
    private readonly bundlePath: string
  ) {}

  evaluate(context: InputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.bundlePath, context, "input");
  }
}

export class RegoToolCallPolicy implements ToolCallPolicy {
  constructor(
    readonly id: string,
    private readonly bundlePath: string
  ) {}

  evaluate(context: ToolCallContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.bundlePath, context, "tool_call");
  }
}

export class RegoOutputPolicy implements OutputPolicy {
  constructor(
    readonly id: string,
    private readonly bundlePath: string
  ) {}

  evaluate(context: OutputContext): Promise<PolicyDecision> {
    return evaluate(this.id, this.bundlePath, context, "output");
  }
}
