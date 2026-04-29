# ViewIntentHandler Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-intent-handler-enforcement.md`.

It keeps the existing engines, checker identities, and rule names unchanged
while making this directory the canonical home for their host wiring and
bundle-local registration metadata:

- `errorprone/`
  `ViewIntentHandlerDependencyBoundary`,
  `ViewIntentHandlerApplicationSinkBoundary`,
  `ViewIntentHandlerViewInputEvent`
- `archunit/`
  `architecture.view.intenthandler.ViewIntentHandlerArchitectureTest`
- `build-harness/`
  `ViewIntentHandlerTopologyRules`
- `bundle.properties`
  canonical registration source for this bundle's public task names and host
  script/source-set wiring
- `root-host.gradle.kts`
  root-project test-source, compiler, and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkViewIntentHandlerEnforcement --rerun-tasks --console=plain`
