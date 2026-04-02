# Changelog

All notable changes to the APS TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Release notes are generated automatically from conventional commits. -->

## [0.1.0] - 2026-04-02

### Added

- `@agentpolicyspecification/core` — engine, policy interfaces (`InputPolicy`, `ToolCallPolicy`, `OutputPolicy`), decision types, and audit handler interface
- `@agentpolicyspecification/dsl` — JSON DSL-based policy evaluation
- `@agentpolicyspecification/http` — HTTP remote policy evaluation
- `@agentpolicyspecification/opa` — OPA REST API policy evaluation
- `@agentpolicyspecification/rego` — OPA WASM in-process policy evaluation
- `@agentpolicyspecification/otel` — OpenTelemetry audit handler
- `@agentpolicyspecification/langfuse` — Langfuse audit handler via OTLP/HTTP
