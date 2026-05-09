# Domain Port Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-port-enforcement.md`.

It keeps the inbound `Port` proof surface strict and owner-pure:

- `build-harness/`
  `DomainPortTopologyRules` and
  `DomainPortEnforcementDocumentationRules`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the inbound domain-internal `Port` role itself.
Generic domain-layer topology, published boundary contracts, and repository
outbound seams stay in their own owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainPortEnforcement --rerun-tasks --console=plain`
