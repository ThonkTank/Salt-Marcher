# Domain Context Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-context-enforcement.md`.

It keeps the full context-contract proof route in one package:

- `build-harness/`
  `DomainContextDocumentationRules`,
  `DomainContextEnforcementCoverageRules`, and
  `DomainContextEnforcementDocumentationCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project aggregate-task wiring
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the canonical domain-context contracts in
`src/domain/**/DOMAIN.md`, the `## Context Roles` and `## Context
Relationships` maps in the Domain Layer Standard, and the matching
coverage-catalog rows in
`docs/project/architecture/enforcement/domain-context-enforcement.md`.
Root `*ApplicationService` presence, data-root `*ServiceContribution`
presence, and broader domain-layer rule ownership stay in neighboring owner
bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainContextEnforcement --rerun-tasks --console=plain`
