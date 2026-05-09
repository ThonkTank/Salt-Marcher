# Layering Indirection Enforcement Bundle

This bundle co-locates the focused SaltMarcher checks that back the relay-chain
and relay-wrapper proof routes referenced by
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `tools/quality/jqassistant/rules/layering/`
  the shared role and production-dependency taxonomy consumed by this bundle
  and the neighboring layering-sprawl diagnostics
- `jqassistant/`
  a blocker-grade substantive relay-wrapper and relay-chain analysis plus the
  report-only thin relay-stack diagnostic
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle proves the compiled-code blockers that the older single-class PMD
source-pattern checks could miss when a wrapper spreads the same relay across
helper methods or when substantive tactical roles degrade into deeper same-scope
relay chains, while keeping the thin relay-stack review scan as a separate
report-only surface of the same owner.

Unified root entrypoint:

- `./gradlew checkLayeringIndirectionEnforcement --rerun-tasks --console=plain`
- `./gradlew checkLayeringIndirectionRelayCandidates --rerun-tasks --console=plain`
