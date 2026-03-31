# aps-typescript

TypeScript implementation of the [Agent Policy Specification (APS)](https://github.com/agentpolicyspecification/spec).

**Status: Pre-release — tracking the APS spec draft.**

## Installation

```bash
npm install @agentpolicyspecification/core
```

## Usage

### Programmatic policies

```typescript
import { ApsEngine, InputPolicy, InputContext, PolicyDecision } from "@agentpolicyspecification/core";

class NoSSNPolicy implements InputPolicy {
  readonly id = "no-ssn";

  evaluate(context: InputContext): PolicyDecision {
    const found = context.messages.some(m => /\b\d{3}-\d{2}-\d{4}\b/.test(m.content));
    return found
      ? { decision: "deny", reason: "Message contains a potential SSN." }
      : { decision: "allow" };
  }
}

const engine = new ApsEngine({
  policySet: {
    input: [new NoSSNPolicy()],
  },
});

await engine.evaluateInput(context);
```

### Rego policies (OPA/WASM)

```typescript
import { ApsEngine, RegoInputPolicy } from "@agentpolicyspecification/core";

const engine = new ApsEngine({
  policySet: {
    input: [new RegoInputPolicy("no-ssn-rego", "./policies/no-ssn.wasm")],
  },
});
```

Rego policies must be compiled to WASM using the OPA CLI:

```bash
opa build -t wasm -e aps/input/decision policies/no-ssn.rego -o policies/no-ssn.tar.gz
```

## API

### `ApsEngine`

| Method | Description |
|---|---|
| `evaluateInput(context)` | Evaluate input policies. Throws `PolicyDenialError` on denial. |
| `evaluateToolCall(context)` | Evaluate tool call policies. Throws `PolicyDenialError` on denial. |
| `evaluateOutput(context)` | Evaluate output policies. Throws `PolicyDenialError` on denial. |

### Errors

| Error | When |
|---|---|
| `PolicyDenialError` | A policy produced a `deny` decision |
| `PolicyEvaluationError` | Policy evaluation itself failed (compilation, runtime error) |

### Policy interfaces

| Interface | Interception point |
|---|---|
| `InputPolicy` | Input |
| `ToolCallPolicy` | Tool call |
| `OutputPolicy` | Output |

See the [APS spec](https://github.com/agentpolicyspecification/spec) for full data model and enforcement contract documentation.

## License

Apache 2.0
