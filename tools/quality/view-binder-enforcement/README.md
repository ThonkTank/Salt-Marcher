# View Binder Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-binder-enforcement.md`.

It keeps the existing engines, checker identities, and rule names unchanged
while making this directory the canonical home for Binder host wiring and
bundle-local registration metadata:

- `errorprone/`
  `ViewBinderDependencyBoundary`,
  `ViewBinderViewInputEventWiring`,
  `ViewBinderApplicationSinkWiring`
- `archunit/`
  `architecture.view.binder.ViewBinderArchitectureTest`
- `jqassistant/`
  `saltmarcher:ViewBinderUsesOwnModelAndSlotSurface`,
  `saltmarcher:ViewBinderDependencies`
- `bundle.properties`
  canonical registration source for this bundle's public task names and host
  script/source-set wiring

Unified root entrypoint:

- `./gradlew checkViewBinderEnforcement --rerun-tasks --console=plain`
