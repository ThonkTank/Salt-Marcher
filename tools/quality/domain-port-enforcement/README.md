# Domain Port Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-port-enforcement.md`.

It keeps the outbound `port/` proof surface strict and owner-pure:

- `errorprone/`
  `DomainPortRoleShape`,
  `DomainPortBoundary`
- `build-harness/`
  `DomainPortEnforcementDocumentationRules` and
  `DomainPortEnforcementDocumentationCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the outbound `port/` role itself. Generic domain-layer
topology, named-module communication boundaries, and neighboring tactical
roles stay in their own owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainPortEnforcement --rerun-tasks --console=plain`
