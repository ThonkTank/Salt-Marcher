# Layering Architecture Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `build-harness/`
  `LayeringArchitectureTopologyRules` and
  `LayeringArchitectureTopologyCheckMain`
- `pmd/`
  `LayeringThinRoleIndirectionCandidateRule` and the report-only bundle-local
  ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path and
  the dedicated Layering bundle plugin

This bundle proves only the repository-wide layer-topology invariants that are
mechanically owned by the layering document itself, plus the report-only
thin-role indirection candidate scan. Neighboring `Enforced Elsewhere` rules
remain in their owning bundles and gates.

Unified root entrypoint:

- `./gradlew checkLayeringArchitectureEnforcement --rerun-tasks --console=plain`
- `./gradlew checkLayeringIndirectionCandidates --rerun-tasks --console=plain`
