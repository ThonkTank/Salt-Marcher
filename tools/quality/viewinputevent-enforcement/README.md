# ViewInputEvent Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-view-input-event-enforcement.md`
and the non-IntentHandler compile-side cross-role seams it references.

It keeps the existing engines and checker identities unchanged while making
this directory the canonical home for their host wiring:

- `errorprone/`
  `ViewInputEventBoundary`
- `archunit/`
  `architecture.view.viewinputevent.ViewInputEventArchitectureTest`
- `build-harness/`
  `ViewInputEventTopologyRules`
- `root-host.gradle.kts`
  root-project test-source, compiler, and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkViewInputEventEnforcement --rerun-tasks --console=plain`
