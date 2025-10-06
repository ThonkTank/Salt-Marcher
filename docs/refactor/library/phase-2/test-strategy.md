# Testing Strategy

## Principles
- Tests precede refactors: contract suites and golden files created before logic changes.
- Feature parity enforced through regression baselines for each renderer, serializer, and watcher behaviour documented in Phase 1.

## Test Types
- **Contract Tests**: Validate Renderer, Storage, Serializer, Validation, and Event Bus ports using shared harness. Ensure lifecycle ordering, error propagation, and telemetry hooks.
- **Golden Files**: Serializer outputs stored under `tests/golden/library`; run diff on each CI build.
- **Property-Based Tests**: Parser/validation DSL ensures invariants (idempotence, boundary cases). Use fast-check integrated in Vitest.
- **Mutation Tests**: Apply to critical services (watchers, application orchestrators) to ensure validation catches tampering.
- **Chaos/Concurrency Probes**: Simulate watcher races, partial writes, and aborted modals.

## Tooling
- Vitest for unit/contract/property suites.
- Stryker for mutation tests targeting watcher/services packages.
- Custom CLI to replay import/preset fixtures in dry-run mode.

## Automation
- CI pipeline stages: `lint` → `test:contracts` → `test:golden` → `test:mutation` (nightly) → `test:chaos` (weekly).
- Telemetry parity counters exported to dashboard verifying legacy vs new path usage.

## Coverage Targets
- ≥ 85% statement/branch coverage in hotspot modules (renderer kernel, serializer template, watcher orchestrator).
- 100% contract coverage for ports (each method executed across suites).

