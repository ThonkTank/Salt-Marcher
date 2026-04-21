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
| `domain-application-no-backend-port-contracts` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Backend port contracts are not placed in `application/`. |
| `domain-application-no-same-context-published` | Error Prone `DomainApplicationNoSameContextPublishedDependency` | `./gradlew compileJava` | Use cases do not depend on their own public published carriers. |
| `domain-module-role-required` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Named domain modules place Java under tactical role packages. |
| `domain-role-direct-files` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Tactical role packages contain direct Java files only. |
| `domain-role-package-name` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Tactical role packages use the allowed role-name set. |
| `domain-forbidden-top-level-bucket` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Legacy technical buckets such as `api`, `repository`, `query`, `gateway`, `adapter`, and `model` are forbidden at context root. |
| `domain-mapcore-removed` | build-harness `DomainFeatureRules` and PMD architecture | `./gradlew checkArchitecture` | `src/domain/mapcore/**` is absent and stable source mentions are blocked. |
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
| `domain-outer-layer-independence` | ArchUnit `domainMustStayIndependentFromOuterLayers` and PMD architecture | `./gradlew checkArchitecture` | Domain code does not depend on `bootstrap`, `shell`, `src.view`, or `src.data`; PMD adds forbidden-token source blockers. |
| `domain-foreign-feature-public-boundary` | ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` and `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Domain/data code reaches foreign contexts only through foreign root services or published carriers. |
| `domain-named-module-private-context` | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Named modules do not reach any foreign domain context. |
| `domain-named-module-no-same-context-application` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Named modules do not depend on their own root or `application/` boundary. |
| `domain-model-roles-no-outbound-ports` | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Model role packages do not depend on outbound ports. |
| `domain-named-module-no-published-carriers` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Named modules import no same-context or foreign published carriers. |
| `domain-port-boundary` | Error Prone `DomainPortBoundary` | `./gradlew compileJava` | Outbound ports are domain-owned interfaces with infrastructure-free signatures and no domain implementations. |
| `domain-public-boundary-signature-purity` | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Public root and published signatures do not leak outer-layer or private domain types. |
| `domain-published-no-foreign-signatures` | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Public root and published signatures do not expose foreign published carriers. |
| `domain-role-shape` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Tactical role packages use their declared type shapes. |
| `domain-field-purity` | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Domain module fields avoid mutable or framework-backed public state. |
| `domain-public-concrete-type-shape` | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public concrete domain types satisfy the project shape constraints. |
| `domain-service-factory-statelessness` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Domain services and factories remain stateless. |
| `domain-feature-cycles` | ArchUnit `domainFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` | Domain features do not form dependency cycles. |
| `domain-module-cycles` | ArchUnit `domainSubpackagesMustStayCycleFree` | `./gradlew checkArchitecture` | Named domain modules do not form dependency cycles. |
| `domain-enforcement-coverage-complete` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | This coverage document lists every required domain enforcement rule with owner and entrypoint. |

## Source-Pattern Checks

PMD architecture is useful for narrow, stable source-pattern blockers: JavaFX,
SQL, shell, bootstrap, data API, filesystem, network, JSON framework, and
`src/domain/mapcore` mentions. It also blocks simple smell patterns such as
root service infrastructure construction, non-public `application/*UseCase`
helper methods beginning with `score`, `rank`, `choose`, `balance`, or
`enforce`, and public/protected JavaBean-style `void set*` mutation methods in
named modules.

These checks are intentionally classified as source-pattern blockers. They are
not semantic proof that policy is in the right tactical role, that ports are
well named, or that published vocabulary is truly domain language.

## Review-Owned

- whether business rules have been implemented in `view` or `data` when no
  stable dependency or forbidden-token violation exposes the leak
- whether a use case is thin orchestration rather than hidden business policy
- whether root application services actually translate public carriers before
  entering use cases or named modules
- whether application use cases pass `published/`, view, data, shell, or
  framework carriers into named modules through shapes not visible to current
  dependency and signature checks
- whether an outbound port is named in domain language rather than in storage
  or vendor language
- whether a `Repository` port is genuinely write-oriented rather than a
  read-only query hidden behind a permitted suffix
- whether a chosen tactical role package is warranted by real model behaviour
  rather than ceremonial taxonomy
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
