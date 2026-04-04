# Agent Policy Specification (APS) — TypeScript Implementation

This repository contains the TypeScript implementation of the [Agent Policy Specification (APS)](https://github.com/agentpolicyspecification/spec).

APS provides a standard way to define, distribute, and enforce safety and compliance policies for AI agents.

## Monorepo Structure

This project is managed as a pnpm workspace:

- **[packages/core](./packages/core)**: The core engine and base types.
- **[packages/rego](./packages/rego)**: Support for Rego/OPA policies (WASM).
- **[integrations/ai-sdk](./integrations/ai-sdk)**: Integration with Vercel AI SDK.
- **[integrations/mastra](./integrations/mastra)**: Integration with Mastra.
- **[integrations/ollama](./integrations/ollama)**: Integration with Ollama.
- **[packages/dsl](./packages/dsl)**: APS Policy DSL parser/evaluator.
- **[packages/http](./packages/http)**: HTTP transport for remote policy evaluation.

## Getting Started

### Installation

```bash
pnpm install
```

### Build

```bash
pnpm run build
```

### Test

```bash
pnpm run test
```

## Usage

See the [Core README](./packages/core/README.md) for detailed usage instructions and examples.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.
