# Domain UseCase Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-use-case-enforcement.md`.

It keeps the full `application/*UseCase.java` proof route in one package:

- `build-harness/`
  `DomainUseCaseTopologyRules`,
  `DomainUseCaseTopologyCheckMain`,
  `DomainUseCaseEnforcementCoverageRules`, and
  `DomainUseCaseDocumentationEnforcementCheckMain`
- `errorprone/`
  `DomainApplicationPublishedBoundaryChecker`
- `pmd/`
  `DomainUseCasePolicyRule` and the bundle-local ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler, PMD, aggregate-task, and full-build hook wiring
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `pmd-host.gradle.kts`
  included-build wiring for the `quality-rules` host

This bundle owns only the `application/*UseCase.java` role itself. Root
`ApplicationService`, `published/`, outbound `port/`, and generic domain-layer
invariants stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainUseCaseEnforcement --rerun-tasks --console=plain`
