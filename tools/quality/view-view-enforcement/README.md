# View Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-view-enforcement.md`.

It keeps the existing checker identities unchanged while making this directory
the canonical home for passive `*View` host wiring:

- `errorprone/`
  `PassiveViewDependencyBoundaries`, `PassiveViewModelReadApis`,
  `PassiveViewModelMutationBoundary`, `ViewPresentationDecisionLeak`,
  `ViewInputEventApi`, `PassiveViewCallbackSeamBoundary`
- `archunit/`
  `architecture.view.view.ViewSurfaceArchitectureTest`
- `jqassistant/`
  `saltmarcher:view-view-enforcement`
- `support/`
  passive-`View` FXML resource validation runner
- `root-host.gradle.kts`
  root-project compiler, support-source, ArchUnit, jQAssistant, and aggregate
  task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host

Unified root entrypoint:

- `./gradlew checkViewEnforcement --rerun-tasks --console=plain`
