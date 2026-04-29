# PublishedEvent Enforcement Bundle

This bundle co-locates the PublishedEvent-owned SaltMarcher checks that back
`docs/project/architecture/enforcement/view-published-event-enforcement.md`.

It keeps the existing engines, checker identities, and rule names unchanged
while making this directory the canonical home for their host wiring:

- `errorprone/`
  `ViewPublishedEventBoundary`,
  `ViewPublishedEventProducerOwnership`
- `archunit/`
  `architecture.view.publishedevent.ViewPublishedEventArchitectureTest`
- `root-host.gradle.kts`
  root-project test-source, compiler, and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host

The matching Binder-installed same-root write sink rule now lives in the
neighboring `view-binder-enforcement` bundle, because it is owned by the
`*Binder` role rather than the carrier role itself.

Unified root entrypoint:

- `./gradlew checkViewPublishedEventEnforcement --rerun-tasks --console=plain`
