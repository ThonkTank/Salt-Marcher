# Success Metrics & Definition of Done

## Quantitative Targets
- **LOC Reduction**: ≥ 25% decrease across library-layer modules (renderers, serializers, stores) measured via `cloc` before/after.
- **Cyclic Dependencies**: ≥ 60% reduction in bidirectional edges compared to Phase 1 `dependency-graph.json` baseline.
- **Public API Surface**: ≥ 30% reduction in exported symbols by consolidating renderer and serializer factories.
- **Coverage**: ≥ 85% statement/branch coverage in hotspots identified in `complexity-coverage.md`.
- **Build Time**: No more than +10% increase in CI duration after adding tests; target parity by optimizing bundling.

## Qualitative Indicators
- Renderer lifecycle and cleanup flows documented and enforced through contract tests.
- Serializers adopt shared template; domain-specific modules contain only differential policies.
- Watcher/event bus interactions recorded with telemetry parity metrics to confirm zero missed events.

## Definition of Done per Work Package
1. **Tests Green**: Contract, golden, regression suites executed successfully.
2. **Documentation Updated**: RFC, relevant ADRs, and dependency graph refreshed.
3. **Telemetry Reviewed**: Parity counters show <1% divergence between legacy and new paths.
4. **Rollback Ready**: Kill switches documented and validated during staging rollout.

## Global Definition of Done
- All legacy factories/adapters removed or formally deprecated with end-of-life date.
- Metrics tracked for two release cycles confirming targets met.
- Stakeholder sign-off recorded in ADR referencing final dependency graph snapshot.

