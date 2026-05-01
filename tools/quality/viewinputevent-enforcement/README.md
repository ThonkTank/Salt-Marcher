# ViewInputEvent Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-view-input-event-enforcement.md`.

It keeps the existing engines and checker identities unchanged while making
this directory the canonical home for their host wiring and bundle-local
registration metadata:

- `errorprone/`
  `ViewInputEventBoundary`
- `archunit/`
  `architecture.view.viewinputevent.ViewInputEventArchitectureTest`
- `build-harness/`
  `ViewInputEventTopologyRules`
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

- `./gradlew checkViewInputEventEnforcement --rerun-tasks --console=plain`
