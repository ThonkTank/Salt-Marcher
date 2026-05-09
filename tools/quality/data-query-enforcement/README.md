# Data Query Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-query-enforcement.md`.

It keeps the full query-role proof route in one package:

- `errorprone/`
  `DataQueryRoleContract`,
  `DataQueryPublicSignatureBoundary`,
  `DataQueryGatewayCollaboratorBoundary`,
  `DataQueryGatewayMutationBoundary`, and
  `DataQueryForeignPublishedReplyChannelRoundTrip`
- `build-harness/`
  `DataQueryPublishedCarrierAnalysis`,
  `DataQueryForeignPublishedPayloadSurfaceRules`,
  `DataQueryPublishedCarrierCandidatesCheckMain`, and
  `DataQueryEnforcementDocumentationRules`
- `pmd/`
  `DataQueryNoSourceMechanicsRule`,
  `DataQueryReadOnlySourceShapeRule`,
  and the dedicated bundle-local PMD ruleset
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle owns only the tactical `query/` read-port adapter role itself.
Feature-root topology, repository write semantics, gateway source-adapter
boundaries, source-model ownership, and broad data-layer constraints stay in
their neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataQueryEnforcement --rerun-tasks --console=plain`
- `./gradlew checkDataQueryPublishedCarrierCandidates --rerun-tasks --console=plain`
