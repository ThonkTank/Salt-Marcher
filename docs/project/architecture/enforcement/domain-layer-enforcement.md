Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for cross-role
domain-layer topology, public boundary families, and domain-wide communication
boundaries in `src/domain/**`.

# Domain Layer Enforcement

## Goal

This document owns the mechanically enforced and review-owned invariants of the
domain layer itself rather than one specific domain role.

It answers three questions for `src/domain/**` as one layer:

- which physical topology every domain context and named module MUST use
- which broad layer-wide structures the domain layer MUST NOT contain
- which external communication seams the domain layer as a whole MAY use

Role-local contracts for `ApplicationService`, `application/*UseCase`,
`published/`, `port/`, context documents, and each tactical domain role live
in the dedicated neighboring enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkDomainLayerEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Layer-focused build-harness, ArchUnit, and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the layer-owned topology and dependency checks without
  pulling unrelated role bundles.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-context-root-boundary-and-module-topology` | Enforced Elsewhere | every active domain context root under `src/domain/<context>/` | `domain-applicationservice-root-presence`; `domain-usecase-direct-file-placement`; `domain-layer-forbidden-top-level-domain-buckets` | `./gradlew checkArchitecture`, `./gradlew checkDomainApplicationServiceEnforcement`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainLayerEnforcement` | Every active domain context exposes exactly one root `*ApplicationService`; direct technical buckets are limited to `published/` and `application/`; `application/` files are restricted to direct use cases and narrow internal boundary helpers; every other direct root directory is a lower-case named domain module. |
| `domain-layer-named-module-role-subpackage-required` | Enforced | every Java type below `src/domain/<context>/<named-module>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Named domain modules do not keep direct Java files at module root. Domain Java below a named module lives under one explicit tactical role package. |
| `domain-layer-tactical-role-package-name-allowlist` | Enforced | every role package below `src/domain/<context>/<named-module>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Tactical role packages are restricted to the canonical allowlist: `aggregate`, `entity`, `value`, `policy`, `port`, `factory`, `service`, `event`, and `specification`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-forbidden-top-level-domain-buckets` | Enforced | every direct child bucket under `src/domain/<context>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Domain context roots do not grow extra technical or tactical buckets beside `published/` and `application/`. Forbidden direct buckets include technical names such as `repository/`, `query/`, `gateway/`, `adapter/`, `model/`, `mapper/`, `schema/`, `record/`, and `api/`, plus tactical-root buckets such as `aggregate/`, `entity/`, `value/`, `policy/`, `port/`, `factory/`, `service/`, `event/`, and `specification/`. |
| `domain-layer-no-published-carrier-dependencies-inside-named-modules` | Enforced | every compilation unit under a named domain module | domain-layer bundle Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` and `./gradlew checkDomainLayerEnforcement` | Named domain modules do not depend on same-context or foreign `published/**` carriers. Published language is translated at the root/application boundary before control enters the model. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-public-boundary-families-only` | Enforced Elsewhere | every type or package under `src/domain/**` that acts as a layer-crossing public boundary or outbound seam | `domain-applicationservice-root-presence`; `domain-applicationservice-public-input-carriers`; `domain-applicationservice-public-return-carriers`; `domain-published-direct-file-placement`; `domain-published-carrier-shape`; `domain-port-role-shape`; `domain-port-ownership-and-signature-boundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkDomainApplicationServiceEnforcement`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainPortEnforcement` | The domain layer exposes only three cross-layer boundary families: root `*ApplicationService` inbound boundaries, carrier-only `published/**` exported language, and domain-owned outbound `port/` interfaces. Internal `application/` helper files are not additional public boundary families. |
| `domain-layer-no-outer-layer-or-infrastructure-dependencies` | Enforced | every type under `src/domain/**` | domain-layer bundle ArchUnit `domainMustStayIndependentFromOuterLayers` and domain-layer bundle Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew checkArchitecture`, `./gradlew compileJava`, and `./gradlew checkDomainLayerEnforcement` | Domain code does not depend on `bootstrap/**`, `shell/**`, `src/view/**`, `src/data/**`, JavaFX, SQL/JDBC, filesystem, network, JSON, transaction, persistence, or similar infrastructure surfaces. |
| `domain-layer-foreign-context-access-only-through-public-boundaries` | Enforced | every dependency from one domain context to another | domain-layer bundle ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Cross-context access reaches foreign domain contexts only through foreign root `*ApplicationService` boundaries or foreign `published/**` carriers. |
| `domain-layer-named-module-no-same-context-application-boundary-dependencies` | Enforced | every dependency from a named domain module to its own context root or `application/` | domain-layer bundle ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Named domain modules do not depend on their own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-layer-named-module-no-foreign-context-dependencies` | Enforced | every dependency from a named domain module to a foreign domain context | domain-layer bundle ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Named domain modules do not reach foreign domain contexts directly. |
| `domain-layer-model-role-no-outbound-port-dependencies` | Enforced | every dependency from `aggregate/`, `entity/`, `value/`, `policy/`, `factory/`, `service/`, `event/`, or `specification/` to a `port/` role | domain-layer bundle ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Internal model roles do not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-core-business-ownership` | Review-Owned | all domain code across `src/domain/**` | none | none | The domain layer still owns business meaning, invariants, policy, use-case coordination, published language, and outbound port interfaces rather than devolving into a thin pass-through or technical convenience zone. |
| `domain-layer-no-ui-translation-or-runtime-composition-ownership` | Review-Owned | all domain code across `src/domain/**` | none | none | A mechanically legal domain package still does not take ownership of UI translation, shell registration, persistence mechanics, data-source records, runtime composition, or similar adapter concerns. |
| `domain-layer-application-orchestration-only-outbound-calls` | Review-Owned | every outward collaboration initiated from `src/domain/**` | none | none | Outward communication leaves the domain core only from root `ApplicationService` or `application/*UseCase` orchestration, and only through same-context outbound ports or allowed foreign root `*ApplicationService` boundaries. Named domain modules do not become their own integration seams. |
| `domain-layer-optional-role-package-necessity` | Review-Owned | every named domain module that defines one or more optional tactical role packages | none | none | Optional tactical role packages are introduced only when they clarify real domain behaviour or contracts; the layer does not accumulate empty or ceremonial DDD partitioning. |
| `domain-layer-technical-vocabulary-rejection` | Review-Owned | all domain package and type naming across `src/domain/**` | none | none | A mechanically legal domain bucket or type name still uses domain language rather than broad technical convenience names that happen not to match the current hard blocker list. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Domain Context Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-context-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Aggregate Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-aggregate-enforcement.md:1)
- [Domain Entity Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-entity-enforcement.md:1)
- [Domain Value Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-value-enforcement.md:1)
- [Domain Policy Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-policy-enforcement.md:1)
- [Domain Factory Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-factory-enforcement.md:1)
- [Domain Service Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-service-enforcement.md:1)
- [Domain Event Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-event-enforcement.md:1)
- [Domain Specification Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-specification-enforcement.md:1)
