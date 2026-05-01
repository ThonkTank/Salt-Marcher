# Domain Published Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-published-enforcement.md`.

It keeps the `published/**` proof route owner-pure and bundle-local:

- `errorprone/`
  `DomainPublishedCarrierShape`,
  `DomainPublishedBoundarySignaturePurity`
- `build-harness/`
  `DomainPublishedTopologyRules`,
  `DomainPublishedTopologyCheckMain`,
  `DomainPublishedEnforcementCoverageRules`, and
  `DomainPublishedDocumentationEnforcementCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler, aggregate-task, and focused-entry wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the exported `published/**` boundary-carrier role.
Root `ApplicationService` public-boundary constraints, `application/*UseCase`
orchestration, outbound `port/` rules, and generic domain-layer communication
boundaries stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainPublishedEnforcement --rerun-tasks --console=plain`
