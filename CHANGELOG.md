# Changelog

All notable changes to the APS TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Release notes are generated automatically from conventional commits. -->

## [1.0.1](https://github.com/agentpolicyspecification/aps-typescript/compare/v1.0.0...v1.0.1) (2026-04-07)


### Features

* Added mastra ([1c5f617](https://github.com/agentpolicyspecification/aps-typescript/commit/1c5f6179ea9187520e6c5fd7353d09f97d9a92d0))


### Bug Fixes

* remove Mach-O opa binary and ignore it ([6ed3c73](https://github.com/agentpolicyspecification/aps-typescript/commit/6ed3c73976c4591896181d5fca6e6bee7d3dce2d))

## 1.0.0 (2026-04-02)


### Features

* restructure as pnpm workspace with focused packages ([e4c2daf](https://github.com/agentpolicyspecification/aps-typescript/commit/e4c2dafa28aab367ce4059a9f9df040d545a4a07))

## [0.1.0] - 2026-04-02

### Added

- `@agentpolicyspecification/core` — engine, policy interfaces (`InputPolicy`, `ToolCallPolicy`, `OutputPolicy`), decision types, and audit handler interface
- `@agentpolicyspecification/dsl` — JSON DSL-based policy evaluation
- `@agentpolicyspecification/http` — HTTP remote policy evaluation
- `@agentpolicyspecification/opa` — OPA REST API policy evaluation
- `@agentpolicyspecification/rego` — OPA WASM in-process policy evaluation
- `@agentpolicyspecification/otel` — OpenTelemetry audit handler
- `@agentpolicyspecification/langfuse` — Langfuse audit handler via OTLP/HTTP
