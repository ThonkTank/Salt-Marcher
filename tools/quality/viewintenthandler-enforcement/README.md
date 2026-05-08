# ViewIntentHandler Enforcement Bundle

This bundle co-locates all currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/view-intent-handler-enforcement.md`.

It keeps the existing engines, checker identities, and rule names unchanged
while making this directory the canonical home for their host wiring,
bundle-local registration metadata, and role-specific helper logic:

- `errorprone/`
  `ViewIntentHandlerDependencyBoundary`,
  `ViewIntentHandlerViewInputEvent`
- `archunit/`
  `architecture.view.intenthandler.ViewIntentHandlerArchitectureTest`
- `build-harness/`
  `ViewIntentHandlerTopologyRules`
- `bundle.properties`
  canonical registration source for this bundle's public task names and host
  script/source-set wiring

Unified root entrypoint:

- `./gradlew checkViewIntentHandlerEnforcement --rerun-tasks --console=plain`

The shared `checkArchitecture` path now reaches IntentHandler enforcement
through this bundle entrypoint instead of collecting the role's ArchUnit and
topology pieces separately in shared aggregators.
