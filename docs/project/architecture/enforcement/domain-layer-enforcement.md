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

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-context-root-boundary-and-module-topology` | Enforced Elsewhere | every active domain context root under `src/domain/<context>/` | `domain-applicationservice-root-presence`; `domain-usecase-direct-file-placement`; `domain-layer-named-module-name-shape`; `domain-layer-forbidden-top-level-domain-buckets` | `./gradlew checkArchitecture` and `./gradlew checkDocumentationEnforcement` | Every active domain context exposes exactly one root `*ApplicationService`; direct technical buckets are limited to `published/` and `application/`; every other direct root directory is a lower-case named domain module. |
| `domain-layer-named-module-role-subpackage-required` | Enforced | every Java type below `src/domain/<context>/<named-module>/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Named domain modules do not keep direct Java files at module root. Domain Java below a named module lives under one explicit tactical role package. |
| `domain-layer-named-module-name-shape` | Enforced | every direct `<named-module>` bucket under `src/domain/<context>/` that is not `published/` or `application/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Named domain modules use lower-case package names matching the documented package-token shape. |
| `domain-layer-tactical-role-package-name-allowlist` | Enforced | every role package below `src/domain/<context>/<named-module>/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Tactical role packages are restricted to the canonical allowlist: `aggregate`, `entity`, `value`, `policy`, `port`, `factory`, `service`, `event`, and `specification`. |
| `domain-layer-public-type-shape` | Enforced | every public type under a named domain module | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public named-module domain types use the allowed project shapes. Interfaces, records, and enums are allowed directly; class-shaped public types must be final or sealed. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-tactical-role-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/<named-module>/<role>/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Tactical role packages contain direct Java files only rather than deeper helper package trees. |
| `domain-layer-forbidden-top-level-domain-buckets` | Enforced | every direct child bucket under `src/domain/<context>/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Domain context roots do not grow extra technical or tactical buckets beside `published/` and `application/`. Forbidden direct buckets include technical names such as `repository/`, `query/`, `gateway/`, `adapter/`, `model/`, `mapper/`, `schema/`, `record/`, and `api/`, plus tactical-root buckets such as `aggregate/`, `entity/`, `value/`, `policy/`, `port/`, `factory/`, `service/`, `event/`, and `specification/`. |
| `domain-layer-public-type-field-mutation` | Enforced | every public non-interface, non-enum type under a named domain module | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public named-module domain types do not expose mutable instance fields or mutable public static fields. |
| `domain-layer-no-published-carrier-dependencies-inside-named-modules` | Enforced | every compilation unit under a named domain module | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Named domain modules do not depend on same-context or foreign `published/**` carriers. Published language is translated at the root/application boundary before control enters the model. |
| `domain-layer-feature-cycle-freedom` | Enforced | all domain contexts under `src/domain/**` | ArchUnit `domainFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` | Domain contexts do not form package-slice dependency cycles. |
| `domain-layer-named-module-cycle-freedom` | Enforced | named modules inside one domain context | ArchUnit `domainSubpackagesMustStayCycleFree` | `./gradlew checkArchitecture` | Named modules inside one domain context do not form package-slice dependency cycles. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-public-boundary-families-only` | Enforced Elsewhere | every type or package under `src/domain/**` that acts as a layer-crossing public boundary or outbound seam | `domain-applicationservice-root-presence`; `domain-applicationservice-public-input-carriers`; `domain-applicationservice-public-return-carriers`; `domain-published-direct-file-placement`; `domain-published-carrier-shape`; `domain-port-role-shape`; `domain-port-ownership-and-signature-boundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDocumentationEnforcement` | The domain layer exposes only three cross-layer boundary families: root `*ApplicationService` inbound boundaries, carrier-only `published/**` exported language, and domain-owned outbound `port/` interfaces. |
| `domain-layer-no-outer-layer-or-infrastructure-dependencies` | Enforced | every type under `src/domain/**` | ArchUnit `domainMustStayIndependentFromOuterLayers` and Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Domain code does not depend on `bootstrap/**`, `shell/**`, `src/view/**`, `src/data/**`, JavaFX, SQL/JDBC, filesystem, network, JSON, transaction, persistence, or similar infrastructure surfaces. |
| `domain-layer-foreign-context-access-only-through-public-boundaries` | Enforced | every dependency from one domain context to another | ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` and `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Cross-context access reaches foreign domain contexts only through foreign root `*ApplicationService` boundaries or foreign `published/**` carriers. |
| `domain-layer-named-module-no-same-context-application-boundary-dependencies` | Enforced | every dependency from a named domain module to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Named domain modules do not depend on their own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-layer-named-module-no-foreign-context-dependencies` | Enforced | every dependency from a named domain module to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Named domain modules do not reach foreign domain contexts directly. |
| `domain-layer-model-role-no-outbound-port-dependencies` | Enforced | every dependency from `aggregate/`, `entity/`, `value/`, `policy/`, `factory/`, `service/`, `event/`, or `specification/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Internal model roles do not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-optional-role-package-necessity` | Review-Owned | every named domain module that defines one or more optional tactical role packages | none | none | Optional tactical role packages are introduced only when they clarify real domain behaviour or contracts; the layer does not accumulate empty or ceremonial DDD partitioning. |
| `domain-layer-technical-vocabulary-rejection` | Review-Owned | all domain package and type naming across `src/domain/**` | none | none | A mechanically legal domain bucket or type name still uses domain language rather than broad technical convenience names that happen not to match the current hard blocker list. |
| `domain-layer-business-policy-not-in-view-or-data` | Review-Owned | cross-layer architecture review of view, domain, and data together | none | none | Business policy ownership is still centered in the domain layer even when no current stable dependency or forbidden-token pattern exposes the leak automatically. |

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
