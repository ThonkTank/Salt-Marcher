# Layering Architecture Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `build-harness/`
  `LayeringArchitectureTopologyRules`,
  `LayeringPassiveCarrierMirrorRules`,
  `LayeringArchitectureTopologyCheckMain`,
  `LayeringArchitectureEnforcementCoverageRules`, and
  `LayeringArchitectureDocumentationEnforcementCheckMain`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle proves the repository-wide layer-topology invariants, the
same-feature passive carrier mirror blocker, and the bundle-local layering
documentation coverage. Neighboring `Enforced Elsewhere` rules remain in
their owning bundles and gates.

Unified root entrypoint:

- `./gradlew checkLayeringArchitectureEnforcement --rerun-tasks --console=plain`
