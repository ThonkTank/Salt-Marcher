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
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the `application/*UseCase.java` role itself. Root
`ApplicationService`, `published/`, `repository/`, `port/`, and generic domain-layer
invariants stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainUseCaseEnforcement --rerun-tasks --console=plain`
