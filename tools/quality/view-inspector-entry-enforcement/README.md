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
- `root-host.gradle.kts`
  root-project compiler, jQAssistant, and aggregate task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkViewInspectorEntryEnforcement --rerun-tasks --console=plain`
