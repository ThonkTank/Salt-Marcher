Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Mechanical and review-owned enforcement coverage for the
canonical Domain Layer Standard.

# Domain Enforcement Coverage

## Goal

This document maps the rules in
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
to the local quality gates that actually block violations. It also names the
remaining review-owned rules so the enforcement set does not overclaim.

## Enforced

- `domain-root-presence`: every domain context exposes exactly one root
  `<PascalFeatureName>ApplicationService.java` directly under
  `src/domain/<feature>/`, owned by `build-harness`.
- `domain-root-public-api-carriers`: every public or protected method on a
  root `*ApplicationService` takes exactly one same-context `published/`
  command/query carrier and returns a same-context `published/` result or
  value carrier directly, owned by Error Prone
  `DomainApplicationServiceApiShape`.
- `domain-root-constructor-ports`: root application services may compose
  same-feature outbound ports by constructor but may not expose data, shell,
  view, JavaFX, SQL, or private implementation types in public signatures,
  owned by Error Prone `DomainPublicBoundarySignaturePurity`.
- `domain-published-direct-files`: `published/` contains direct Java files
  only, owned by `build-harness`.
- `domain-published-carrier-shape`: public `published/` types must be records,
  enums, or sealed abstractions, owned by Error Prone
  `DomainPublishedCarrierShape`.
- `domain-published-no-callable-contracts`: `published/` must not contain
  callable contracts such as `*ApplicationService`, `*Service`, `*Facade`,
  `*Repository`, `*Lookup`, `*Catalog`, `*Search`, `*Port`, `*Gateway`,
  `*Factory`, `*Locator`, or `*Policy`, owned by `build-harness`.
- `domain-application-direct-usecases`: `application/` contains direct
  `*UseCase.java` files only, owned by `build-harness`.
- `domain-application-no-backend-port-contracts`: `application/` does not own
  backend port contracts ending `Repository`, `Lookup`, `Catalog`, or
  `Search`, owned by `build-harness`.
- `domain-module-role-required`, `domain-role-direct-files`, and
  `domain-role-package-name`: named domain modules must place Java files as
  direct files under allowed role packages only: `aggregate`, `entity`,
  `value`, `policy`, `port`, `factory`, `service`, `event`, and
  `specification`, owned by `build-harness`.
- `domain-forbidden-top-level-bucket`: legacy direct buckets such as `api`,
  `repository`, `query`, `gateway`, `adapter`, `controller`, `model`,
  `service`, `usecase`, and plural role buckets are forbidden directly under
  `src/domain/<feature>/`, owned by `build-harness`.
- `domain-mapcore-removed`: `src/domain/mapcore/**` is forbidden, owned by
  `build-harness` and PMD architecture source policy.
- `domain-context-roles-complete` and
  `domain-context-relationships-complete`: `docs/standards/domain-layer.md`
  must include every active domain context in `## Context Roles` and
  `## Context Relationships`, and the declared role must match each
  context's `DOMAIN.md`, owned by `build-harness`.
- `domain-context-document-presence`, `domain-context-shape-declared`, and
  `domain-context-required-sections`: every `src/domain/<feature>/DOMAIN.md`
  must exist, declare exactly one allowed `Context Role: ...`, and include
  non-empty `## Context Role`, `## Published Language`,
  `## Application Boundary`, and `## Ubiquitous Language` sections, owned by
  `build-harness`.
- `domain-role-context-required-sections`,
  `domain-authored-context-write-model-required`, and
  `domain-aggregate-marker-shape`: authored truth contexts must include
  `## Aggregate Model`, `## Commands And Invariants`, and
  `## Consistency Model`, must not declare `Write Model: None`, and must
  declare `Aggregate Root: <TypeName>` markers that resolve to existing named
  module role types, owned by `build-harness`.
- `domain-generation-policy-required-sections`,
  `domain-generation-policy-write-model-none`, and
  `domain-generation-policy-ephemeral-rationale`: generation policy contexts
  must include commands and consistency sections, declare `Write Model: None`,
  and explain the absence of authored truth in
  `## Ephemeral Policy Rationale`, owned by `build-harness`.
- `domain-outer-layer-independence`: domain code must not depend on
  `bootstrap`, `shell`, `src.view`, or `src.data`, owned by ArchUnit
  `domainMustStayIndependentFromOuterLayers` and PMD architecture source
  policy.
- `domain-foreign-feature-public-boundary`: domain and data code may use only
  foreign root application services or foreign `published/` carriers, owned by
  ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` and
  `dataFeaturesMustOnlyUseForeignFeatureApis`.
- `domain-named-module-private-context`: named domain modules must not depend
  on any foreign domain context, including foreign public carriers, owned by
  ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts`.
- `domain-model-roles-no-outbound-ports`: aggregate, entity, value, policy,
  factory, service, event, and specification roles must not depend on outbound
  `port/` interfaces; application use cases or adapters receive ports, owned
  by ArchUnit `domainModelRolesMustNotDependOnOutboundPorts`.
- `domain-named-module-no-published-carriers`: named modules must not import
  same-feature or foreign `published/` carriers, owned by Error Prone
  `DomainModuleNoPublishedCarrierDependency`.
- `domain-role-shape`: aggregate, entity, value, port, policy, factory,
  service, event, and specification packages must use their declared type
  shapes, owned by Error Prone `DomainRoleShape`.
- `domain-field-purity` and `domain-public-concrete-type-shape`: shared
  domain-module field and concrete-type shape constraints are owned by Error
  Prone `DomainModuleFieldPurity` and `DomainPublicConcreteTypeShape`.
- `domain-service-factory-statelessness`: domain `service/` and `factory/`
  role classes are stateless, owned by Error Prone
  `DomainServiceFactoryStatelessness`.
- `domain-feature-cycles` and `domain-module-cycles`: feature and named-module
  dependency cycles are forbidden, owned by ArchUnit
  `domainFeaturesMustStayCycleFree` and `domainSubpackagesMustStayCycleFree`.

## Source-Pattern Checks

PMD architecture owns narrow source-pattern blockers for obvious domain leaks
such as JavaFX, SQL, shell, bootstrap, data API, and `src/domain/mapcore`
mentions, plus application-layer helper names that indicate hidden policy in
use cases. These checks are intentionally treated as smell blockers. They are
useful for stable forbidden tokens and naming patterns; they are not semantic
proof that behavior sits in the right domain role.

## Review-Owned

- whether a use case is thin orchestration rather than hidden business policy
- whether an outbound port is named in domain language rather than in storage
  or vendor language
- whether aggregate, entity, value, policy, factory, service, specification,
  and event behavior is rich enough for the role name
- whether `published/` language is stable and intentionally versioned enough
  for view models and foreign contexts
- whether commands, invariants, consistency notes, and ubiquitous language in
  `DOMAIN.md` accurately describe real behavior

These remain review-owned because the available local tools would either need
fixtures, brittle semantic inference, or broad text heuristics that would
produce low-signal results.
