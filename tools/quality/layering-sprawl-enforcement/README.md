# Layering Sprawl Enforcement Bundle

This bundle co-locates the report-only SaltMarcher checks that back the
broader architecture-debt diagnostics referenced by
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `tools/quality/jqassistant/rules/layering/`
  the shared role and production-dependency taxonomy consumed by the broader
  layering graph diagnostics
- `jqassistant/`
  candidate-grade role-hub, cross-feature, and public-boundary breadth
  analysis
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the missing role-aware graph-level sprawl signals. It
does not replace existing cycle blockers, PMD non-architecture smells,
whole-program public dead-code reachability, or CKJM hotspot reporting.

Unified root entrypoint:

- `./gradlew checkLayeringSprawlCandidates --rerun-tasks --console=plain`
