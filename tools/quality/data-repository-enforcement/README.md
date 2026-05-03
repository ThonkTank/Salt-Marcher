# Data Repository Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-repository-enforcement.md`.

It keeps the `src/data/**/repository/` proof route owner-pure and bundle-local:

- `build-harness/`
  `DataRepositoryEnforcementDocumentationRules` and
  `DataRepositoryEnforcementDocumentationCheckMain`
- `errorprone/`
  `DataRepositoryRoleContractChecker`,
  `DataRepositoryPublicSignatureBoundaryChecker`, and
  `DataRepositoryGatewayCollaboratorBoundaryChecker`
- `pmd/`
  `DataRepositorySourceMechanicsRule`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the write-side `repository/` role itself: own-feature
write-port contract shape, public adapter surface, gateway collaborator
boundaries, and the direct prohibition on concrete source mechanics. Query
read-only semantics, feature-root discovery/export, gateway placement, mapper
rules, source-model ownership, and `persistencecore/` genericity stay in their
neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataRepositoryEnforcement --rerun-tasks --console=plain`
