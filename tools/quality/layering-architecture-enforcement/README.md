# Layering Architecture Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `build-harness/`
  `LayeringArchitectureTopologyRules` and
  `LayeringArchitectureTopologyCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle proves only the repository-wide layer-topology invariants that are
mechanically owned by the layering document itself. Neighboring `Enforced
Elsewhere` rules remain in their owning bundles and gates.

Unified root entrypoint:

- `./gradlew checkLayeringArchitectureEnforcement --rerun-tasks --console=plain`
