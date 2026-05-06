# Domain Published Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-published-enforcement.md`.

It keeps the `published/**` proof route owner-pure and bundle-local:

- `errorprone/`
  `DomainPublishedCarrierShape`,
  `DomainPublishedBoundarySignaturePurity`,
  `DomainPublishedReadModelShape`
- `build-harness/`
  `DomainPublishedTopologyRules`,
  `DomainPublishedTopologyCheckMain`,
  `DomainPublishedEnforcementCoverageRules`, and
  `DomainPublishedDocumentationEnforcementCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the exported `published/**` boundary-carrier role.
Root `ApplicationService` public-boundary constraints, `application/*UseCase`
orchestration, outbound `port/` rules, and generic domain-layer communication
boundaries stay in their neighboring owner bundles and documents. Within this
bundle, direct read-side `*Model` publication handles keep their public API to
`current()` and `subscribe(...)` only.

Unified root entrypoint:

- `./gradlew checkDomainPublishedEnforcement --rerun-tasks --console=plain`
