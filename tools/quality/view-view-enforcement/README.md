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
  bundle-local `architecture.view.view.ViewSurfaceArchitectureTest`
- `jqassistant/`
  `saltmarcher:view-view-enforcement`
- `bundle.properties`
  canonical registration source for this bundle's public task names and host
  script/source-set wiring
- `support/`
  passive-`View` FXML resource validation runner
  jQAssistant, and aggregate task wiring

Unified root entrypoint:

- `./gradlew checkViewEnforcement --rerun-tasks --console=plain`
