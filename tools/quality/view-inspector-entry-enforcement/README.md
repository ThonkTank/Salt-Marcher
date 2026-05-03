# View InspectorEntry Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-inspector-entry-enforcement.md`.

It keeps the existing checker identity `ViewInspectorEntryDependencyBoundary`
while making this directory the canonical home for all InspectorEntry-specific
rule definitions, InspectorEntry-specific Error Prone policy, and host wiring:

- `errorprone/`
  `ViewInspectorEntryDependencyBoundary`,
  `ViewInspectorEntryShellApiAllowlist`
- `build-harness/`
  `ViewInspectorEntryTopologyRules`,
  `ViewInspectorEntryTopologyCheckMain`
- `jqassistant/`
  `saltmarcher:view-inspector-entry-enforcement`

Unified root entrypoint:

- `./gradlew checkViewInspectorEntryEnforcement --rerun-tasks --console=plain`
