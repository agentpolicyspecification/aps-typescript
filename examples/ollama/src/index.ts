import { Ollama } from "ollama";
import { withAps } from "@agentpolicyspecification/ollama";
import { ApsEngine, PolicyDenialError } from "@agentpolicyspecification/core";
import type { Tool, ToolCall } from "ollama";
import { createRuntimeEngine } from "./policies/runtime.js";
import { createDslEngine } from "./policies/dsl.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL = "llama3.1";
const OLLAMA_HOST = process.env["OLLAMA_HOST"] ?? "http://localhost:11434";

const ollama = new Ollama({ host: OLLAMA_HOST });

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SAFE_PROMPT = "What is the capital of France? Answer in one sentence.";
const BLOCKED_PROMPT = "My SSN is 123-45-6789, can you store it?";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function run(engine: ApsEngine, prompt: string): Promise<void> {
  const client = withAps(ollama, {
    engine,
    metadata: { agent_id: "example", session_id: "demo" },
  });

  try {
    const response = await client.chat({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    });
    console.log(`  ✓  "${prompt}"`);
    console.log(`     → ${response.message.content.trim()}`);
  } catch (err) {
    if (err instanceof PolicyDenialError) {
      console.log(`  ✗  "${prompt}"`);
      console.log(`     → blocked by ${err.policy_id ?? "policy"}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

async function runWithTools(engine: ApsEngine, prompt: string, tools: Tool[]): Promise<void> {
  const client = withAps(ollama, {
    engine,
    metadata: { agent_id: "example", session_id: "demo" },
  });

  try {
    const response = await client.chat({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      tools,
    });

    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      const calls = response.message.tool_calls.map((tc: ToolCall) =>
        `${tc.function.name}(${JSON.stringify(tc.function.arguments)})`
      ).join(", ");
      console.log(`  ✓  "${prompt}"`);
      console.log(`     → tool calls: ${calls}`);
    } else {
      console.log(`  ✓  "${prompt}"`);
      console.log(`     → ${response.message.content.trim()}`);
    }
  } catch (err) {
    if (err instanceof PolicyDenialError) {
      console.log(`  ✗  "${prompt}"`);
      console.log(`     → blocked by ${err.policy_id ?? "policy"}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

function section(title: string): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

// ─── Tools definition ─────────────────────────────────────────────────────────

const WEATHER_TOOL: Tool = {
  type: "function",
  function: {
    name: "get_weather",
    description: "Get the current weather for a city.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "The city name." },
      },
      required: ["city"],
    },
  },
};

const DANGEROUS_TOOL: Tool = {
  type: "function",
  function: {
    name: "delete_file",
    description: "Delete a file from the filesystem.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file." },
      },
      required: ["path"],
    },
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nAPS × Ollama — policy type examples");
  console.log(`  model : ${MODEL}`);
  console.log(`  host  : ${OLLAMA_HOST}`);

  // ── Runtime (TypeScript classes) ──────────────────────────────────────────
  section("Runtime  (TypeScript class)");
  const runtimeEngine = createRuntimeEngine();
  await run(runtimeEngine, SAFE_PROMPT);
  await run(runtimeEngine, BLOCKED_PROMPT);

  // ── DSL (JSON rule files) ─────────────────────────────────────────────────
  section("DSL      (JSON rule file)");
  const dslEngine = createDslEngine();
  await run(dslEngine, SAFE_PROMPT);
  await run(dslEngine, BLOCKED_PROMPT);

  // ── Tool call policies ────────────────────────────────────────────────────
  section("Tool calls  (Runtime policy)");
  await runWithTools(runtimeEngine, "What is the weather in Amsterdam?", [WEATHER_TOOL]);
  await runWithTools(runtimeEngine, "Please delete the file at /etc/passwd.", [DANGEROUS_TOOL]);

  console.log("\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
