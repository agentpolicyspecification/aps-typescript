import {
  ApsEngine,
  type InputPolicy,
  type InputContext,
  type PolicyDecision,
  type ToolCallPolicy,
  type ToolCallContext,
  PolicyDenialError,
} from "../src/index.js";

// ─── Runtime policies ────────────────────────────────────────────────────

class NoSSNInputPolicy implements InputPolicy {
  readonly id = "no-ssn-input";

  evaluate(context: InputContext): PolicyDecision {
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;
    const found = context.messages.some((m) => ssnPattern.test(m.content));
    return found
      ? { decision: "deny", reason: "Message contains a potential SSN." }
      : { decision: "allow" };
  }
}

class ApprovedToolsPolicy implements ToolCallPolicy {
  readonly id = "approved-tools";
  private readonly approved = new Set(["web_search", "read_file", "summarize"]);

  evaluate(context: ToolCallContext): PolicyDecision {
    return this.approved.has(context.tool_name)
      ? { decision: "allow" }
      : { decision: "deny", reason: `Tool '${context.tool_name}' is not approved.` };
  }
}

// ─── Engine setup ─────────────────────────────────────────────────────────────

const engine = new ApsEngine({
  policySet: {
    on_error: "deny",
    input: [new NoSSNInputPolicy()],
    tool_call: [new ApprovedToolsPolicy()],
  },
  onAudit: (record) => {
    console.log("[audit]", record.interception_point, record.decision, record.reason ?? "");
  },
});

// ─── Example: allowed input ───────────────────────────────────────────────────

const allowedInput: InputContext = {
  messages: [{ role: "user", content: "What is the weather in Amsterdam?" }],
  metadata: { agent_id: "agent-1", session_id: "session-1", timestamp: new Date().toISOString() },
};

await engine.evaluateInput(allowedInput);
console.log("Input allowed.");

// ─── Example: denied input ────────────────────────────────────────────────────

const deniedInput: InputContext = {
  messages: [{ role: "user", content: "My SSN is 123-45-6789, can you store it?" }],
  metadata: { agent_id: "agent-1", session_id: "session-1", timestamp: new Date().toISOString() },
};

try {
  await engine.evaluateInput(deniedInput);
} catch (err) {
  if (err instanceof PolicyDenialError) {
    console.log("Input denied:", err.message);
  }
}

// ─── Example: denied tool call ────────────────────────────────────────────────

const deniedToolCall: ToolCallContext = {
  tool_name: "delete_file",
  arguments: { path: "/workspace/important.txt" },
  calling_message: { role: "assistant", content: "I will delete the file." },
  metadata: { agent_id: "agent-1", session_id: "session-1", timestamp: new Date().toISOString() },
};

try {
  await engine.evaluateToolCall(deniedToolCall);
} catch (err) {
  if (err instanceof PolicyDenialError) {
    console.log("Tool call denied:", err.message);
  }
}
