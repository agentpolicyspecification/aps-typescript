# Contributing to aps-typescript

Thank you for your interest in contributing to the APS TypeScript SDK.

## Prerequisites

- Node.js 18 or later
- pnpm (the workspace uses pnpm workspaces)

## Getting Started

```sh
git clone https://github.com/agentpolicyspecification/aps-typescript.git
cd aps-typescript
pnpm install
pnpm build
pnpm test
```

## Repository Layout

```
packages/
  core/       Engine, policy interfaces, types, and errors
  dsl/        DSL-based policy evaluation
  http/       HTTP remote policy evaluation
  opa/        OPA REST API policy evaluation
  rego/       OPA WASM in-process policy evaluation
  otel/       OpenTelemetry audit handler
  langfuse/   Langfuse audit handler
```

## Making a Change

1. Fork the repository and create a branch from `main`.
2. Make your changes. Add or update tests as appropriate.
3. Run `pnpm test` and ensure all tests pass.
4. Open a pull request with a clear description of what changed and why.

## Reporting Bugs

Open an issue at [github.com/agentpolicyspecification/aps-typescript/issues](https://github.com/agentpolicyspecification/aps-typescript/issues). Include:

- A minimal reproducible example
- The package name and version
- What you expected to happen and what actually happened

## Requesting Features

Open an issue describing the use case you are trying to address. Proposals that align with the [APS specification](https://github.com/agentpolicyspecification/spec) are most likely to be accepted.

## Coding Conventions

- All packages use TypeScript strict mode.
- Public API surface must remain compatible with the APS enforcement contract defined in the spec.
- Avoid adding runtime dependencies without discussion — keep each package lean.

## License

By contributing you agree that your contributions will be licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
