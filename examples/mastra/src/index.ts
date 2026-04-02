import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { withAps, withApsTools } from "@agentpolicyspecification/mastra";
import { ApsEngine, PolicyDenialError } from "@agentpolicyspecification/core";
import { createRuntimeEngine } from "./policies/runtime.js";
import { createDslEngine } from "./policies/dsl.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const openai = createOpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SAFE_PROMPT = "What is the capital of France? Answer in one sentence.";
const BLOCKED_PROMPT = "My SSN is 123-45-6789, can you store it?";

// ─── Tools ────────────────────────────────────────────────────────────────────

const getWeatherTool = createTool({
  id: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("The city name."),
  }),
  outputSchema: z.object({
    temperature: z.string(),
    condition: z.string(),
  }),
  execute: async (_input) => {
    return { temperature: "18°C", condition: "Partly cloudy" };
  },
});

const deleteFileTool = createTool({
  id: "delete_file",
  description: "Delete a file from the filesystem.",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file."),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async (_input) => {
    return { success: true };
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function run(engine: ApsEngine, prompt: string): Promise<void> {
  const agent = new Agent({
    id: "aps-agent",
    name: "APS Agent",
    instructions: "You are a helpful assistant. Answer concisely.",
    model: openai("gpt-4o-mini"),
  });

  const apsAgent = withAps(agent, {
    engine,
    metadata: { agent_id: "mastra-example", session_id: "demo" },
  });

  try {
    const result = await apsAgent.generate(prompt) as { text: string };
    console.log(`  ✓  "${prompt}"`);
    console.log(`     → ${result.text.trim()}`);
  } catch (err) {
    if (err instanceof PolicyDenialError) {
      console.log(`  ✗  "${prompt}"`);
      console.log(`     → blocked by ${err.policy_id ?? "policy"}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

async function runWithTools(
  engine: ApsEngine,
  prompt: string,
  tools: Record<string, ReturnType<typeof createTool>>,
): Promise<void> {
  const wrappedTools = withApsTools(tools, {
    engine,
    metadata: { agent_id: "mastra-example", session_id: "demo" },
  });

  const agent = new Agent({
    id: "aps-tool-agent",
    name: "APS Tool Agent",
    instructions: "You are a helpful assistant. Use the provided tools when appropriate.",
    model: openai("gpt-4o-mini"),
    tools: wrappedTools,
  });

  const apsAgent = withAps(agent, {
    engine,
    metadata: { agent_id: "mastra-example", session_id: "demo" },
  });

  try {
    const result = await apsAgent.generate(prompt) as { text: string };
    console.log(`  ✓  "${prompt}"`);
    console.log(`     → ${result.text.trim()}`);
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nAPS × Mastra — policy type examples");

  section("Runtime  (TypeScript class)");
  const runtimeEngine = createRuntimeEngine();
  await run(runtimeEngine, SAFE_PROMPT);
  await run(runtimeEngine, BLOCKED_PROMPT);

  section("DSL      (JSON rule file)");
  const dslEngine = createDslEngine();
  await run(dslEngine, SAFE_PROMPT);
  await run(dslEngine, BLOCKED_PROMPT);

  section("Tool calls  (Runtime policy)");
  await runWithTools(runtimeEngine, "What is the weather in Amsterdam?", { get_weather: getWeatherTool });
  await runWithTools(runtimeEngine, "Please delete the file at /etc/passwd.", { delete_file: deleteFileTool });

  console.log("\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
