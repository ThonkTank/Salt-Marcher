# Migration Strategy

## Approach
Adopt a strangler-fig migration: wrap legacy modules with compatibility adapters while gradually routing traffic through new ports. Telemetry and feature flags monitor parity and enable instant rollback.

## Phases
1. **Contract Harness Setup**
   - Implement contract tests and golden files before altering code paths.
   - Introduce compatibility facades exposing both v1 and v2 signatures.
2. **Renderer Kernel Rollout**
   - Deploy Renderer Contract v2 behind `renderer.v2.enabled` flag.
   - Bridge existing renderers via `toLegacyBridge` to ensure v1 consumers operate unchanged.
3. **Serializer Template Adoption**
   - Generate serializer outputs in parallel (legacy + template) and diff results in dry-run mode.
   - Promote template output once parity counters stabilise for 7 consecutive days.
4. **Watcher/Event Bus Transition**
   - Register watcher events on new bus while still emitting legacy callbacks.
   - Enable kill switch to disable bus if concurrency probes detect drift.
5. **Cleanup & Deletion**
   - Remove legacy adapters once telemetry shows <1% fallback usage and regression suite passes for two release cycles.

## Compat Layer
- Provide facade modules exporting both v1/v2 signatures with shared implementations.
- Use configuration-driven kill switches stored in user settings with default `false` for new behaviour.

## Data Migration
- Serializers run in dry-run mode to detect schema diffs; persist migrations only when validation passes.
- Backups: prior to enabling new template, snapshot storage resources (`presets.json`, `damage.json`, etc.) into versioned archive.

## Rollback Plan
- Kill switch flips restore legacy factories immediately.
- Event bus supports `drain` then disable to avoid message loss.
- Storage transactions run compensating rollback scripts stored alongside templates.

