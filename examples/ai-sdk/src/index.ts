import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { withAps } from "@agentpolicyspecification/ai-sdk";
import { ApsEngine, PolicyDenialError } from "@agentpolicyspecification/core";
import type { AuditHandler } from "@agentpolicyspecification/core";
import { createLangfuseAuditHandler } from "@agentpolicyspecification/langfuse";
import { createRuntimeEngine } from "./policies/runtime.js";
import { createDslEngine } from "./policies/dsl.js";
import { createRegoEngine } from "./policies/rego.js";
import { createOpaEngine } from "./policies/opa.js";

import './instrumentation.js'
// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAFE_PROMPT = "What is the capital of Spain?";
const BLOCKED_PROMPT = "My SSN is 123-45-6789, can you store it?";

const openai = createOpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

async function run(label: string, engine: ApsEngine, prompt: string): Promise<void> {
  const model = withAps(openai("gpt-4o-mini",), {
    engine,
    metadata: { agent_id: "example", session_id: "demo" },
  });

  try {
    const { text } = await generateText({
      model, prompt, experimental_telemetry: { isEnabled: true },
    });
    console.log(`  ✓  "${prompt}"`);
    console.log(`     → ${text}`);
  } catch (err) {
    if (err instanceof PolicyDenialError) {
      console.log(`  ✗  "${prompt}"`);
      console.log(`     → blocked by ${err.policy_id ?? "policy"}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

const langfuseAuditHandler = createLangfuseAuditHandler({
  publicKey: process.env["LANGFUSE_PUBLIC_KEY"],
  secretKey: process.env["LANGFUSE_SECRET_KEY"],
  baseUrl: process.env["LANGFUSE_BASE_URL"],
});

async function section(
  title: string,
  createEngine: (onAudit: AuditHandler) => ApsEngine,
): Promise<void> {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);

  let engine: ApsEngine;
  try {
    engine = createEngine(() => { });
  } catch (err) {
    console.log(`  ⚠  Could not initialise engine: ${String(err)}`);
    return;
  }

  await run(title, engine, SAFE_PROMPT);
  await run(title, engine, BLOCKED_PROMPT);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nAPS × Vercel AI SDK — policy type examples");

  await section("Runtime  (TypeScript class)", createRuntimeEngine);
  await section("DSL      (JSON rule file)", createDslEngine);

  // Rego requires a compiled .tar.gz bundle — see fixtures/rego/no-ssn-input.rego
  try {
    await section("Rego     (OPA WASM, in-process)", createRegoEngine);
  } catch {
    console.log("  ⚠  Rego bundle not found. Run:");
    console.log("     opa build --target=wasm --entrypoint=aps/input/decision \\");
    console.log("       fixtures/rego/no-ssn-input.rego --output fixtures/rego/no-ssn-input.tar.gz");
  }

  // OPA REST requires a running server — see policies/opa.ts for instructions
  try {
    await section("OPA      (REST API)", createOpaEngine);
  } catch (err) {
    const msg = err instanceof Error ? (err.message + String((err as NodeJS.ErrnoException).cause ?? "")) : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      console.log("  ⚠  OPA server not reachable. Start it first:");
      console.log(`     opa run --server --addr=:8181`);
      console.log("     curl -X PUT http://localhost:8181/v1/policies/no-ssn \\");
      console.log("       --data-binary @fixtures/rego/no-ssn-input.rego");
    } else {
      throw err;
    }
  }

  await langfuseAuditHandler.flush();
  console.log("\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
