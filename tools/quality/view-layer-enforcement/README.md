# View Layer Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-layer-enforcement.md`.

It keeps the existing checker identity `ViewLayerTopologyRules` while making
this directory the canonical home for the focused host wiring and the
slotcontent `ContentModel` requirement proof.

It owns:

- `bundle.properties`
  descriptor-owned bundle id, order, task names, and host wiring
- `build-harness/`
  `ViewLayerTopologyRules` and `ViewLayerTopologyCheckMain`
- `archunit/`
  `architecture.view.viewlayer.ViewLayerArchitectureTest`

Unified root entrypoint:

- `./gradlew checkViewLayerEnforcement --rerun-tasks --console=plain`

Shared baseline ArchUnit/build-harness infrastructure remains intentionally
outside this directory; view-layer-specific rule ownership and bundle metadata
now live here.
