# Domain Port Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-port-enforcement.md`.

It keeps the inbound `Port` proof surface strict and owner-pure:

- `build-harness/`
  `DomainPortTopologyRules` and
  `DomainPortEnforcementDocumentationRules`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the inbound domain-internal `Port` role itself.
Generic domain-layer topology, published boundary contracts, and repository
outbound seams stay in their own owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainPortEnforcement --rerun-tasks --console=plain`
