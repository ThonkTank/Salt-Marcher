# Domain Event Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-event-enforcement.md`.

It keeps the `event/` proof route strict and role-local:

- `errorprone/`
  `DomainEventRoleShape`
- `build-harness/`
  `DomainEventEnforcementDocumentationRules` and
  `DomainEventEnforcementDocumentationCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the tactical `event/` role itself. Generic named-module
topology, forbidden-content rules, and broader domain-layer communication
boundaries stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainEventEnforcement --rerun-tasks --console=plain`
