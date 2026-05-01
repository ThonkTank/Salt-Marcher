# ViewContentModel Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-content-model-enforcement.md`.

It keeps the existing engines and rule intent unchanged while making this
directory the canonical home for the ContentModel host wiring. Internal
ArchUnit, jQAssistant, and topology tasks remain implementation details of
the bundle; the root task below is the only supported focused entrypoint:

- `errorprone/`
  `ViewContentModelDependencyBoundary`,
  `ViewContentModelFlatSurface`
- `archunit/`
  `architecture.view.contentmodel.ViewContentModelArchitectureTest`
- `build-harness/`
  `ViewContentModelTopologyRules`
- `jqassistant/`
  `saltmarcher:view-contentmodel-enforcement`
- `root-host.gradle.kts`
  root-project compiler, ArchUnit, jQAssistant, build-path, and aggregate-task
  wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Supported focused root entrypoint:

- `./gradlew checkViewContentModelEnforcement --rerun-tasks --console=plain`
