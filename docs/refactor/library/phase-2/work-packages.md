# Work Package Plan

## Overview
Sequencing follows the dependency graph: remove cycles, establish shared kernels/templates, then consolidate implementations. Each ticket references regression and contract test requirements to maintain feature parity.

## Epics and Packages

### Epic A: Dependency Cycle Removal (Impact: High, Complexity: Medium)
- **WP-A1: Renderer ↔ Storage decoupling**
  - **Tickets**:
    - A1-T1 (M): Introduce Application Service port mediating renderer data requests; refactor renderer entry points to call service.
    - A1-T2 (S): Wrap persistence adapter behind StoragePort interface; update watcher subscriptions to use service callbacks.
  - **Dependencies**: None.
  - **Risks**: Service orchestration errors leading to stale UI updates.
  - **Mitigation**: Contract tests for RendererPort/StoragePort; dry-run mode verifying request/response payloads.
  - **Rollback**: Feature flag toggles renderer back to legacy direct calls.

- **WP-A2: Modal ↔ Watcher isolation**
  - **Tickets**:
    - A2-T1 (M): Extract watcher orchestration into EventBusPort with typed payloads.
    - A2-T2 (S): Update create modals to subscribe via Renderer lifecycle hook.
  - **Dependencies**: Requires Renderer Contract v2 (WP-B1) to expose lifecycle events.
  - **Risks**: Missed unsubscribe causing duplicate events.
  - **Mitigation**: Lifecycle regression tests; mutation tests on watcher cleanup.
  - **Rollback**: Toggle to legacy watcher binding and revert port registration.

### Epic B: Shared Kernels & Templates (Impact: High, Complexity: High)
- **WP-B1: Renderer Kernel introduction**
  - **Tickets**:
    - B1-T1 (L): Implement RendererKernel with query execution, pagination, selection, and cleanup pipeline.
    - B1-T2 (M): Adapt existing renderers (List, Detail, Modal) via plugin adapters.
    - B1-T3 (S): Provide compatibility shim bridging v1 contract to v2 for downstream consumers.
  - **Dependencies**: WP-A1 completed (ensures service ports ready).
  - **Risks**: Plugin adoption gaps causing missing renderer behaviours.
  - **Mitigation**: Golden snapshot tests for renderer outputs; contract suite verifying lifecycle ordering.
  - **Rollback**: Kill switch re-enables legacy renderer factory.

- **WP-B2: Serializer template & validation DSL**
  - **Tickets**:
    - B2-T1 (M): Create generic serializer template with round-trip tests and policy hooks (defaults, migration rules).
    - B2-T2 (M): Port Presets, Loadouts, Damage serializers onto template; remove duplicate pipelines.
    - B2-T3 (S): Introduce shared validation DSL with property-based tests for edge cases.
  - **Dependencies**: B1 (shared utilities for plugin error reporting) optional but recommended.
  - **Risks**: Migration mistakes corrupting saved data.
  - **Mitigation**: Golden files, dry-run import validations, backup/restore script.
  - **Rollback**: Compatibility layer writing legacy serializer output when flag enabled.

### Epic C: Consolidation & Cleanup (Impact: Medium, Complexity: Medium)
- **WP-C1: Filter/Sort/Search pipeline unification**
  - **Tickets**:
    - C1-T1 (M): Abstract filtering pipeline into reusable service used by renderer kernel.
    - C1-T2 (S): Delete redundant utility functions across renderers; update imports.
  - **Dependencies**: WP-B1.
  - **Risks**: Behavioural drift in edge-case filtering.
  - **Mitigation**: Regression suite with golden query cases; property-based tests for filter idempotence.
  - **Rollback**: Retain legacy utilities behind feature flag fallback.

- **WP-C2: Store simplification**
  - **Tickets**:
    - C2-T1 (M): Collapse derived stores using new event bus notifications.
    - C2-T2 (S): Remove unused watchers flagged in risk log; ensure concurrency probes remain.
  - **Dependencies**: WP-A2, WP-B1.
  - **Risks**: Missed subscriber updates.
  - **Mitigation**: Chaos tests simulating concurrent updates; coverage thresholds on store reducers.
  - **Rollback**: Re-enable deprecated stores using compat module.

### Epic D: Test & Rollout Enablement (Impact: High, Complexity: Low)
- **WP-D1: Contract & regression harness**
  - **Tickets**:
    - D1-T1 (S): Implement contract test harness shared across renderer/serializer/storage ports.
    - D1-T2 (S): Define golden file fixtures for serializers in `tests/golden/library`.
  - **Dependencies**: None; executes before functional refactors.
  - **Risks**: Initial build time increase.
  - **Mitigation**: Parallelize test suites; run in CI nightly.
  - **Rollback**: N/A—tests only.

- **WP-D2: Telemetry & kill switches**
  - **Tickets**:
    - D2-T1 (S): Add feature flag registry with remote override config.
    - D2-T2 (S): Instrument renderer/service interactions with parity counters.
  - **Dependencies**: WP-B1.
  - **Risks**: Over-instrumentation affecting performance.
  - **Mitigation**: Sampled logging with rate limits.
  - **Rollback**: Disable telemetry module via config.

## Sequencing Summary
1. WP-D1 (tests), then WP-A1 to remove critical UI↔IO cycle.
2. WP-B1/B2 introduce kernels/templates leveraging stabilized ports.
3. WP-A2 finalizes watcher decoupling once renderer lifecycle available.
4. WP-C1/C2 consolidate utilities and stores.
5. WP-D2 completes rollout controls.

## Effort Legend
- **S**: ≤ 2 dev-days.
- **M**: 3–5 dev-days.
- **L**: > 5 dev-days.

