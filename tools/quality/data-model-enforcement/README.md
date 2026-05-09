# Data Model Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-model-enforcement.md`.

It keeps the `src/data/**/model/` proof route owner-pure and bundle-local:

- `archunit/`
  `DataModelArchitectureTest`
- `build-harness/`
  `DataModelTopologyRules`,
  `DataModelTopologyCheckMain`,
  `DataModelEnforcementCoverageRules`, and
  `DataModelDocumentationEnforcementCheckMain`
- `errorprone/`
  `DataModelSourceShapeChecker`
- `pmd/`
  `DataModelSchemaDdlPlacementRule`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the data `model/` role itself: source-model shape,
public-signature boundaries, schema ownership, schema DDL placement, and
model-to-domain independence. Data feature-root discovery, repository/query
mechanics, gateway boundaries, mapper rules, and `persistencecore/` genericity
stay in their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataModelEnforcement --rerun-tasks --console=plain`
