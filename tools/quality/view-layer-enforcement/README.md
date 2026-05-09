# View Layer Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-layer-enforcement.md`.

It keeps the existing checker identity `ViewLayerTopologyRules` while making
this directory the canonical home for the focused host wiring and the closed
reusable-slotcontent three-role topology proof.

It owns:

- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring
- `build-harness/`
  `ViewTopologyPerimeterRules` and `ViewLayerTopologyRules`

Unified root entrypoint:

- `./gradlew checkViewLayerEnforcement --rerun-tasks --console=plain`

`checkViewEnforcement` consumes this closed-world topology proof transitively
before the merged compile-bound view role checks run.
