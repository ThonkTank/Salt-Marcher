Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Mechanical and review-owned enforcement coverage for the
canonical Domain Layer Standard.

# Domain Enforcement Coverage

## Goal

This document maps the rules in
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
to local quality gates that actually block violations. It also names the
remaining review-owned rules so the enforcement set does not overclaim.

The umbrella coverage document is an enforcement routing index. This document
is the canonical domain-specific coverage inventory.

## Enforced Rule Matrix

| Rule ID | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- |
| `domain-root-presence` | build-harness `DomainFeatureRules` and `SourceLayoutRules` | `./gradlew checkArchitecture` | Each active context has exactly one root service file named from `Context Name:`. |
| `domain-context-name-declared` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Every `DOMAIN.md` has exactly one `Context Name: <PascalContext>` marker. |
| `domain-root-class-shape` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root application services are public final top-level boundary classes. |
| `domain-root-public-api-carriers` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root public methods use same-context command/query inputs and same-context published results. |
| `domain-root-no-nested-contracts` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root services do not publish nested public/protected contract types. |
| `domain-root-constructor-composition` | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Root constructors expose only same-feature ports or foreign root application services. |
| `domain-service-registry-root-only` | Error Prone `DomainServiceRegistryExportShape` | `./gradlew compileJava` | Data service roots export only their same-feature root application service key. |
| `domain-published-direct-files` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | `published/` carriers are direct files under `src/domain/<context>/published/`. |
| `domain-published-carrier-shape` | Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` | Public published types are public records, enums, or sealed abstractions. |
| `domain-published-no-callable-contracts` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | `published/` does not contain callable service, repository, port, gateway, factory, locator, or policy contracts by suffix. |
| `domain-application-direct-usecases` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | `application/` contains direct `*UseCase.java` files only. |
| `domain-application-no-generic-usecase-names` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | `application/` use case filenames do not encode generic operations, helper, adapter, repository, mapper, or policy buckets. |
| `domain-application-no-backend-port-contracts` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Backend port contracts are not placed in `application/`. |
| `domain-application-no-same-context-published` | Error Prone `DomainApplicationNoSameContextPublishedDependency` | `./gradlew compileJava` | Use cases do not depend on their own public published carriers. |
| `domain-module-role-required` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Named domain modules place Java under tactical role packages. |
| `domain-module-name-shape` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Named domain modules use lower-case package names matching `[a-z][a-z0-9_]*`. |
| `domain-role-direct-files` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Tactical role packages contain direct Java files only. |
| `domain-role-package-name` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Tactical role packages use the allowed role-name set. |
| `domain-forbidden-top-level-bucket` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Legacy technical buckets such as `api`, `repository`, `query`, `gateway`, `adapter`, and `model` are forbidden at context root. |
| `domain-mapcore-removed` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | `src/domain/mapcore/**` is absent. |
| `domain-context-roles-complete` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | `docs/standards/domain-layer.md` lists every active context role and no stale context. |
| `domain-context-relationships-complete` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | `docs/standards/domain-layer.md` lists every active context relationship and no stale context. |
| `domain-context-document-presence` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Every active domain context has a `DOMAIN.md`. |
| `domain-context-shape-declared` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Every `DOMAIN.md` has exactly one allowed `Context Role:` marker. |
| `domain-context-required-sections` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Every `DOMAIN.md` includes non-empty base context sections. |
| `domain-role-context-required-sections` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Authored truth contexts include aggregate, command, and consistency sections. |
| `domain-authored-context-write-model-required` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Authored truth contexts do not declare `Write Model: None`. |
| `domain-aggregate-marker-shape` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Authored truth contexts declare aggregate roots that resolve to named-module role types. |
| `domain-generation-policy-required-sections` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Generation policy contexts include command and consistency sections. |
| `domain-generation-policy-write-model-none` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Generation policy contexts declare `Write Model: None`. |
| `domain-generation-policy-ephemeral-rationale` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Generation policy contexts explain why they own no persisted authored truth. |
| `domain-forbidden-infrastructure-dependency` | Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew compileJava` | Domain code does not reference compiler-resolved outer-layer, infrastructure, JavaFX, persistence, filesystem, network, JSON, or transaction types. |
| `domain-outer-layer-independence` | ArchUnit `domainMustStayIndependentFromOuterLayers` and Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Domain code does not depend on `bootstrap`, `shell`, `src.view`, or `src.data`. |
| `domain-foreign-feature-public-boundary` | ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` and `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Domain/data code reaches foreign contexts only through foreign root services or published carriers. |
| `domain-named-module-private-context` | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Named modules do not reach any foreign domain context. |
| `domain-named-module-no-same-context-application` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Named modules do not depend on their own root or `application/` boundary. |
| `domain-model-roles-no-outbound-ports` | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Model role packages do not depend on outbound ports. |
| `domain-named-module-no-published-carriers` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Named modules import no same-context or foreign published carriers. |
| `domain-port-boundary` | Error Prone `DomainPortBoundary` | `./gradlew compileJava` | Outbound ports are domain-owned interfaces with infrastructure-free signatures and no domain implementations. |
| `domain-public-boundary-signature-purity` | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Public root and published signatures do not leak outer-layer or private domain types. |
| `domain-published-no-foreign-signatures` | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Public root and published signatures do not expose foreign published carriers. |
| `domain-role-shape` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Tactical role packages use their declared type shapes. |
| `domain-field-purity` | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public domain module fields do not expose mutable state. |
| `domain-public-concrete-type-shape` | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public concrete domain types satisfy the project shape constraints. |
| `domain-service-factory-statelessness` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Domain services, factories, and policies remain stateless. |
| `domain-feature-cycles` | ArchUnit `domainFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` | Domain features do not form dependency cycles. |
| `domain-module-cycles` | ArchUnit `domainSubpackagesMustStayCycleFree` | `./gradlew checkArchitecture` | Named domain modules do not form dependency cycles. |
| `domain-enforcement-coverage-complete` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | This coverage document lists every required domain enforcement rule with owner and entrypoint. |

## Coverage Inventory

Domain enforcement coverage is complete when every rule in the Domain Layer
Standard is represented by one of three things: an enforced matrix row, an
enforced source-pattern row, or an explicit review-owned bullet. The
build-harness verifies required enforced rule IDs are documented with a
mechanical owner and blocking Gradle entrypoint. It does not attempt to infer
semantic coverage from prose.

## Source-Pattern Checks

PMD architecture is useful for narrow, stable source-pattern blockers. For
domain code it reinforces obvious JavaFX, SQL/JDBC, filesystem, network, and
JSON framework package-token references, and blocks simple smell patterns such
as root service infrastructure construction, non-public
`application/*UseCase` helper methods beginning with `score`, `rank`, `choose`,
`balance`, or `enforce`, and public/protected JavaBean-style `void set*`
mutation methods in named modules.

These checks are intentionally classified as source-pattern blockers. They are
not semantic proof that policy is in the right tactical role, that ports are
well named, or that published vocabulary is truly domain language.

| Rule ID | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- |
| `domain-source-no-infrastructure-token-source-pattern` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Domain source text does not contain the configured JavaFX, SQL/JDBC, filesystem, network, or JSON framework package tokens. |
| `domain-root-no-infrastructure-construction-source-pattern` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Root application service source text does not directly construct or cache obvious infrastructure-style collaborators. |
| `domain-application-no-policy-helper-prefix-source-pattern` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Non-public `application/*UseCase` helpers do not use the configured policy-heavy prefixes `score`, `rank`, `choose`, `balance`, or `enforce`. |
| `domain-named-module-no-setter-mutation-source-pattern` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Named modules do not expose public or protected JavaBean-style `void set*` mutation methods by source shape. |

## Review-Owned

- whether business rules have been implemented in `view` or `data` when no
  stable dependency or forbidden-token violation exposes the leak
- whether a use case is thin orchestration rather than hidden business policy
- whether `application/` has become a generic operations or policy dump despite
  passing file-name and helper-prefix checks
- whether root application services actually translate public carriers before
  entering use cases or named modules
- whether a foreign root application service injected into a root constructor
  is semantically documented by the context relationship prose rather than only
  type-compatible
- whether application use cases pass `published/`, view, data, shell, or
  framework carriers into named modules through shapes not visible to current
  dependency and signature checks
- whether an outbound port is named in domain language rather than in storage
  or vendor language
- whether a `Repository` port is genuinely write-oriented rather than a
  read-only query hidden behind a permitted suffix
- whether a chosen tactical role package is warranted by real model behaviour
  rather than ceremonial taxonomy
- whether a named domain-module directory name is a useful ubiquitous-language
  concept after the build proves only its package-token shape
- whether the context role and relationship prose in the Domain Layer Standard
  accurately describes ownership and collaboration after the build proves only
  marker presence and stale-context coverage
- whether a domain service is real cross-concept domain behavior rather than a
  procedural coordinator
- whether additional callable client boundaries are semantically being exposed
  through names or usage patterns that do not match the blocked suffixes
- whether aggregate, entity, value, policy, factory, service, specification,
  and event behavior is rich enough for the role name when that role is used
- whether `published/` language is stable and intentionally versioned enough
  for view models and foreign contexts
- whether `published/` carriers are passive boundary language rather than
  invariant-owning objects hidden behind allowed record, enum, or sealed shapes
- whether `published/` names such as row, selection, cell, or summary describe
  domain facts rather than presentation or storage concepts
- whether commands, invariants, consistency notes, and ubiquitous language in
  `DOMAIN.md` accurately describe real behavior
- whether feature-local domain documents redefine system-wide topology in
  prose without changing the machine-readable context markers

These remain review-owned because the available local tools would either need
runtime fixtures, brittle semantic inference, or broad text heuristics that
would produce low-signal results.
