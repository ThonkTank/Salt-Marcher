# ADR-0002: Adopt Renderer Contract v2 Kernel

- **Status**: Proposed
- **Date**: 2024-04-06

## Context
Phase 1 audits uncovered lifecycle gaps and direct IO dependencies in renderer modules (`renderer-contract-audit.md`, `dependency-graph.json`). Existing contract v1 lacks cleanup hooks and forces UI components to access storage/watchers directly, creating cycles and leaks.

## Decision
Introduce Renderer Contract v2 with lifecycle-aware kernel:
- Renderer factory exposes `bootstrap`, `connect`, `handleQuery`, `handleEvent`, and `dispose`.
- Telemetry + kill switch embedded in context to support strangler rollout.
- Legacy compatibility shim generated via `toLegacyBridge` for gradual migration.

## Consequences
- Short-term abstraction cost offset by centralised plugin architecture.
- Enables removal of UI↔IO cycles when combined with application service ports.
- Requires new contract tests and telemetry instrumentation; build time slightly increases.

