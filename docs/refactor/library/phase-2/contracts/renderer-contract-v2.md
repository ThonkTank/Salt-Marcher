# Renderer Contract v2 Specification

## Purpose
Provides a unified lifecycle-aware renderer interface to decouple UI views from application services and IO layers. Replaces ad-hoc modal/list renderers with a plugin-driven kernel.

## Lifecycle
1. `bootstrap` receives the renderer context and returns an instance bound to lifecycle defaults.
2. `connect` registers lifecycle hooks (pre/post mount). Hooks must execute sequentially and may short-circuit if `killSwitch()` is true.
3. `handleQuery` processes query updates; it is idempotent and must emit diff-based state updates back to the renderer kernel.
4. `handleEvent` dispatches UI interactions or watcher messages via the application service.
5. `dispose` runs cleanup, ensures watchers are detached, and flushes telemetry parity counters.

## Error Strategy
- Recoverable errors trigger telemetry `log('warn')` and return without throwing.
- Non-recoverable errors bubble as rejected promises containing `RendererError` with `recoverable=false`.
- Kill switch toggles must immediately stop processing and invoke `dispose`.

## Query Handling
- `supportsQuery` advertises recognized query keys; unrecognized keys result in telemetry warnings.
- Query payloads map to service DTOs defined in the application layer.

## Legacy Bridge
- `toLegacyBridge` produces a v1-compatible adapter for gradual migration.
- Legacy mode is disabled when feature flag indicates v2 readiness.

## Telemetry
- `parityCounter` tracks operations executed via v1 vs v2 to ensure behavioural parity during rollout.

