# View Layer Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-layer-enforcement.md`.

It keeps the existing checker identity `ViewLayerTopologyRules` while making
this directory the canonical home for the focused host wiring and the
slotcontent `ContentModel` requirement proof.

It owns:

- `build-harness/`
  `ViewLayerTopologyRules` and `ViewLayerTopologyCheckMain`
- `archunit/`
  `architecture.view.viewlayer.ViewLayerArchitectureTest`
- `root-host.gradle.kts`
  root-project test-source and aggregate-task wiring
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkViewLayerEnforcement --rerun-tasks --console=plain`
