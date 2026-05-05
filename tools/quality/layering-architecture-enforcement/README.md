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
- `pmd/`
  a report-only bundle-local ruleset that configures the shared
  `CeremonialIndirectionRule` for the thin-role candidate surface
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path,
  including the report-only `checkLayeringIndirectionCandidates` PMD task

This bundle proves the repository-wide layer-topology invariants, the
same-feature passive carrier mirror blocker, the bundle-local layering
documentation coverage, and the report-only thin-role indirection candidate
scan. Neighboring `Enforced Elsewhere` rules remain in their owning bundles
and gates.

Unified root entrypoint:

- `./gradlew checkLayeringArchitectureEnforcement --rerun-tasks --console=plain`
- `./gradlew checkLayeringIndirectionCandidates --rerun-tasks --console=plain`
