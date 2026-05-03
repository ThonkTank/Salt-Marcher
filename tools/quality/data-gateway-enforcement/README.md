# Data Gateway Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/data-gateway-enforcement.md`.

It keeps the `src/data/**/gateway/**` proof route owner-pure and bundle-local:

- `archunit/`
  `DataGatewayArchitectureTest`
- `build-harness/`
  `DataGatewayEnforcementDocumentationRules` and
  `DataGatewayEnforcementDocumentationCheckMain`
- `errorprone/`
  `DataGatewayReturnTypeBoundaryChecker`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle owns only the internal `gateway/` source-adapter role itself:
public/protected signature boundaries, domain independence, and the gateway
document's bundle-local coverage proof. Feature-root topology, service export
shape, repository/query contracts, source-model ownership, and broad data-layer
rules stay in neighboring owner bundles and documents.

Unified root entrypoint:

- `./gradlew checkDataGatewayEnforcement --rerun-tasks --console=plain`
