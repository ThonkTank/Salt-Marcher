Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Per-surface architecture rule status, mechanical owner, and
blocking-task mapping for active code surfaces.

# Architecture Enforcement Coverage Standard

## Goal

This standard records which architecture rules currently block local quality,
which engine owns each blocker, and which documented rules remain review-owned.

The shared owner model, execution model, diagnostic contract, lifecycle, and
review-only boundary remain defined in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).

## View Layer

Current view checks enforce the declarative MVVM topology from ADR 017 plus the
Shared View Component boundary from ADR 018.

`Enforced`:

- `view-topology-allowlist` via `jQAssistant`
  `saltmarcher:MvvmAllowedViewBuckets` (`checkViewArchitecture`).
- `view-legacy-bucket-ban` via `jQAssistant`
  `saltmarcher:MvvmNoLegacyBuckets` (`checkViewArchitecture`).
- `view-root-only-view-contribution` via `jQAssistant`
  `saltmarcher:MvvmRootOnlyViewContribution` (`checkViewArchitecture`).
- `view-root-count` via `jQAssistant`
  `saltmarcher:MvvmViewRootEntrypointCount` (`checkViewArchitecture`).
- `view-cross-component-public-api-only` via `jQAssistant`
  `saltmarcher:MvvmNoPrivateForeignComponentDependencies`
  (`checkViewArchitecture`).
- `view-root-contracts` via PMD `SaltMarcherEntrypointRule`
  (`pmdArchitectureMain`).
- `view-root-delegation-boundary` via Error Prone `ViewRootDelegation`
  (`compileJava`). Root view contributions may use the documented shell API
  subset, own `View/` and `ViewModel/`, domain application-service boundaries,
  and declared shared component `api/` packages.
- `view-shell-api-allowlist` via Error Prone `FeatureShellApiAllowlist`
  (`compileJava`).
- `view-rendering-boundary` via Error Prone `ViewRestrictedDependencies`
  (`compileJava`).
- `view-viewmodel-framework-independence` via Error Prone
  `ViewModelFrameworkIndependence` (`compileJava`).
- `view-presentation-state-placement` via Error Prone
  `ViewModelOwnershipNaming` (`compileJava`).
- `view-reflection-bypass-ban` via Error Prone `ViewReflectionBypass`
  (`compileJava`).
- `view-component-cycle-freedom` via ArchUnit
  `viewComponentsMustStayCycleFree` (`architectureTest`).

Current mechanical trace against the declarative MVVM checks:

- Normal component topology in
  `src/view/<component>/{<Component>ViewContribution.java,View,ViewModel}` and
  declared Shared View Component topology in
  `src/view/<component>/{api,View,ViewModel}` are enforced by the jQAssistant
  MVVM topology rules.
- `assembly/`, `Model/`, `Controller`, `interactor`, and non-shared view
  `api/` buckets are blocked by jQAssistant.
- The component-root rule of exactly one `*ViewContribution`, plus root naming,
  constructor, implemented shell interface, required methods, statelessness, and
  supported contribution spec construction for normal components is enforced by
  jQAssistant and PMD. Declared Shared View Components are enforced as having
  zero `*ViewContribution` roots.
- Inward source dependency direction is enforced by Error Prone for root,
  `View/`, and `ViewModel/` packages, with ArchUnit and jQAssistant covering
  broader component cycles and cross-component private bucket access.
- `View/` is the only bucket allowed to own JavaFX scene-graph implementation
  broadly, and `ViewModel/` may use JavaFX beans and collections only.
- Public view reuse is mechanically public only through declared foreign shared
  `api/` packages. Private foreign `View/` and `ViewModel/` packages remain
  blocked.
- Presentation-state carrier placement is mechanically name-based for
  `*ViewModel`, `*ViewData`, `*State`, `*Status`, `*Section`, and `*Model`
  style names outside `ViewModel/` or declared shared `api/`.
- Reflection bypasses under `src/view/**`, including `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, `MethodHandles.Lookup.findClass(...)`, and
  direct `java.lang.reflect.*` references, are blocked by Error Prone.

Target mechanical trace:

- FXML files live under `resources/view/<component>/`.
- Target view components use only root `*ViewContribution`, `View/`, and
  `ViewModel/` buckets.
- Declared Shared View Components use only `api/`, `View/`, and `ViewModel/`
  buckets and have no root `*ViewContribution`.
- `View/` may use JavaFX UI, scene, stage, fxml, bean, and collection APIs,
  but not shell, domain, or data APIs.
- `ViewModel/` may use JavaFX bean and collection APIs, but not scene, stage,
  fxml, shell, data, own `View/`, or foreign private view packages.
- Root view contributions are the only shell-facing composition adapters for
  view components.
- Foreign view imports are allowed only to declared shared component `api/`.
- `src.domain.<feature>.api/**` stays carrier-only, while the callable model
  boundary is the root application service.

`Review-Only`:

- Whether remaining non-shared view `api/` and `assembly/` packages are
  migration debt and whether touched code moves toward declarative MVVM.
- Whether root entrypoints are semantically thin beyond the mechanically
  encoded shape, dependency, and delegation checks.
- Whether root view contributions remain thin shell/composition adapters
  instead of accumulating presentation or business logic.
- Whether `View/` logic is simple binding/projection and gesture forwarding
  rather than duplicated presentation policy.
- Whether `ViewModel/` is the single owner of user-triggered actions,
  domain-response mapping, cross-widget presentation decisions, and shared
  presentation state.
- Whether command availability, disabled reasons, results, and user-visible
  failures are owned by `ViewModel/` rather than inferred in widgets.
- Whether long-lived listeners, subscriptions, callbacks, and observers have
  explicit removal, disposal, weak-listener use, or a documented shell-lifetime
  rationale.
- Whether asynchronous presentation work keeps blocking I/O off the UI thread
  and leaves loading, failure, cancellation, retry, and stale-result semantics
  under `ViewModel/` ownership.
- Whether shell-specific type usage below the root entrypoint
  is semantically acceptable when the distinction is about intent rather than
  referenced type shape.
- Whether changes to legacy surfaces move toward the MVVM target model.
- Runtime callback-flow semantics and lifecycle behavior that cannot be
  expressed as stable source, bytecode, or graph rules today.

## Domain Layer

`Enforced`:

- `domain-layout`, `domain-root-presence`, `domain-top-level-role-bucket-ban`,
  `domain-module-name-shape`, `domain-api-no-backend-port-contracts`,
  `domain-application-no-backend-port-contracts`,
  `domain-context-document-presence`, `domain-context-shape-declared`,
  `domain-supporting-context-rationale`, `domain-context-map-complete`,
  `domain-context-map-role-matches`,
  `domain-policy-context-required-sections`, `domain-aggregate-marker-shape`,
  and `domain-supporting-context-promotion-triggers` via `build-harness`
  (`:build-harness:check`). These checks cover root application-service
  presence, the direct `api/` and `application/` allowances, lower-case named
  domain-module package shape, bans on technical role buckets, backend-port
  contract exclusion from `api/` and `application/`, and the required
  `DOMAIN.md` context marker plus supporting read-model rationale, promotion
  triggers, policy-context tactical sections, aggregate-root markers, the
  domain-layer-standard context-map listing for every domain feature, and
  context-map role text matching each feature's declared context marker.
- `domain-outer-layer-independence`,
  `domain-foreign-feature-public-seams-only`, and
  `domain-feature-cycle-freedom`, and `domain-subpackage-cycle-freedom` via
  `ArchUnit` (`architectureTest`).
- `domain-framework-and-infra-leakage`,
  `domain-root-no-direct-infra-composition`,
  `domain-application-no-policy-helper-methods`, and
  `domain-no-setter-style-mutation` via `PMD architecture`
  (`pmdArchitectureMain`). The policy-helper check blocks application-layer
  helpers named like domain policy verbs, while leaving boundary/query
  normalization review-owned; the setter-style check blocks public/protected
  JavaBean-style `void setX(...)` mutation methods in named domain modules.
- `domain-public-boundary-no-private-or-outer-signature-leaks`: public
  operational members on `*ApplicationService` roots and public `api/`
  signatures stay free of outer-layer types, foreign private domain types, and
  same-feature internal domain-module types via `Error Prone` (`compileJava`).
- `domain-root-constructor-port-composition`: public/protected root
  `*ApplicationService` constructors are composition seams, not
  client-facing operations; they may accept same-feature domain-owned port
  interfaces and public domain boundaries, but must not expose outer-layer
  types, foreign private domain types, or same-feature concrete application
  and model collaborators via `Error Prone` (`compileJava`).
- `domain-module-no-api-carrier-dependency`: named domain modules may not
  depend on same-feature API command, query, result, draft, snapshot, page,
  detail, options, or payload carriers via `Error Prone` (`compileJava`).
- `domain-public-concrete-type-shape`: public concrete named-module domain
  types must be records, enums, final classes, or sealed abstractions via
  `Error Prone` (`compileJava`).
- `domain-module-field-purity`: public concrete named-module domain types must
  not expose non-final instance fields or mutable public static fields via
  `Error Prone` (`compileJava`).
- `domain-api-carrier-shape`: public `api/` types must be records, enums, or
  sealed abstractions via `Error Prone` (`compileJava`).
- `domain-service-factory-statelessness`: named-module domain types ending in
  `Service` or `Factory` must not declare instance fields via `Error Prone`
  (`compileJava`).

`Candidate`:

- No current Domain Layer candidate checks are accepted. New mechanical checks
  require a stable source, compiler, bytecode, graph, or file-tree shape before
  promotion.

`Review-Only`:

- Object-centred placement, named-module cohesion and ubiquitous-language
  naming beyond package-shape checks and required document sections,
  application-layer thinness beyond direct infrastructure composition,
  `api/` carrier-only discipline beyond shape and same-feature carrier
  dependency checks, semantic business-rule leakage, aggregate mutation semantics,
  true-invariant placement inside one aggregate, small and coherent aggregate
  boundaries, reference-by-identity and eventual-consistency choices, broad
  mutable object graphs across aggregates, one-aggregate-per-transaction,
  supporting read-model justification, declared context classification quality,
  domain-service/factory naming quality, and boundary/query normalization that
  does not own domain policy.

## Data Layer

`Enforced`:

- `data-layout`: allowed data buckets, data-root placement, gateway source
  bucket placement, and `persistencecore/` bucket placement via `build-harness`
  (`:build-harness:check`).
- `persistence-root-entrypoint`: exactly one
  `<PascalFeatureName>ServiceContribution.java` per non-`persistencecore`
  data feature via `build-harness` (`:build-harness:check`).
- `service-contribution-placement`: `*ServiceContribution.java` roots are
  allowed only as `shell/api/ServiceContribution.java` or as data feature
  roots at `src/data/<feature>/<Feature>ServiceContribution.java` via
  `build-harness` (`:build-harness:check`).
- `persistence-schema-contract`: the current stricter schema-entrypoint
  blocker, requiring exactly one `*PersistenceSchema` under every current
  non-`persistencecore` data feature, via `build-harness`
  (`:build-harness:check`).
- `data-schema-table-name-owned-by-schema`: exact duplicate table-name string
  literals from a feature `*PersistenceSchema` must not be repeated elsewhere
  in that data feature via `build-harness` (`:build-harness:check`).
- `data-root-contracts`: root naming, `public final`, public no-arg
  constructor, implemented shell interface, required
  `register(ServiceRegistry.Builder)`, no instance fields, and no additional
  public/protected members via `PMD architecture` (`pmdArchitectureMain`).
- `data-root-registration-boundary`: `*ServiceContribution` roots may register
  only own-feature `*ApplicationService` roots, nested application-service
  factory types, and own-feature domain-owned `*Repository` or `*Port`
  contracts into `ServiceRegistry` via `PMD architecture`
  (`pmdArchitectureMain`).
- `data-query-read-only-obvious-mutation-ban`: `query/` adapters must not
  expose obvious public/protected mutation methods via `PMD architecture`
  (`pmdArchitectureMain`).
- `data-adapter-no-concrete-source-mechanics`: `repository/` and `query/`
  adapters must not directly reference concrete source APIs such as SQL, HTTP,
  or file-system mechanics via `PMD architecture` (`pmdArchitectureMain`).
- `data-mapper-no-concrete-source-mechanics`: `mapper/` translation code must
  not directly reference concrete source APIs such as SQL, HTTP, or file-system
  mechanics via `PMD architecture` (`pmdArchitectureMain`).
- `data-schema-ddl-owned-by-schema`: feature DDL literals in active source
  roots must live in the owning `model/<Feature>PersistenceSchema.java`
  declaration or generic `persistencecore/` infrastructure via
  `PMD architecture` (`pmdArchitectureMain`).
- `data-outer-layer-independence`,
  `data-foreign-domain-public-seams-only`,
  `data-cross-feature-private-bucket-ban`,
  `data-feature-cycle-freedom`,
  `data-model-domain-independence`,
  `persistencecore-feature-independence`, and
  `persistencecore-domain-independence` via `ArchUnit` (`architectureTest`).
- `data-gateway-return-boundary`: public/protected gateway methods must not
  expose return types outside JDK value/container types or same-feature
  `model/` records via `Error Prone` (`compileJava`).
- `data-adapter-signature-no-internal-leaks`: public/protected repository and
  query adapter signatures, including constructors, must not leak `model/`,
  `gateway/`, or `persistencecore` internal infrastructure types via
  `Error Prone` (`compileJava`).
- `data-adapter-role-contract`: `repository/` adapters implement repository
  contracts and `query/` adapters implement read-model/query contracts via
  `Error Prone` (`compileJava`).
- `data-exported-adapter-gateway-collaborator-boundary`: `repository/` and
  `query/` adapters may depend on own-feature `gateway/local` or
  `gateway/remote` facade types ending in `Gateway`, but must not directly
  depend on source-mechanic gateway collaborators such as stores, migrators,
  table managers, or connection factories via `Error Prone` (`compileJava`).
- `data-adapter-public-contract-placement`: public non-adapter boundary types
  such as interfaces, records, enums, or abstract classes must not be declared
  in `repository/` or `query/`; data-facing contracts and carriers belong in
  the owning domain boundary via `Error Prone` (`compileJava`).
- `data-service-registry-registration-placement`: direct
  `ServiceRegistry.Builder.register(...)` calls must stay in data feature
  `*ServiceContribution` roots via `Error Prone` (`compileJava`).
- `data-adapter-contract-presence`: public concrete `repository/` and `query/`
  adapters must satisfy an own-feature domain-owned contract for their adapter
  role via `Error Prone` (`compileJava`).
- `data-domain-port-adapter-placement`: data classes outside `repository/` and
  `query/` must not implement exported domain repository or read-model/query
  port contracts via `Error Prone` (`compileJava`).

Mechanical trace against the data-layer standard:

- Data topology and entrypoint presence are enforced by `build-harness`:
  allowed data buckets, `gateway/local` and `gateway/remote`, `persistencecore`
  bucket placement, exactly one data root, service-contribution placement, and
  the current stricter schema declaration requirement.
- `*ServiceContribution` root shape is enforced by PMD, direct service-registry
  call placement and shell API access are enforced by Error Prone, and allowed
  registered service types are checked by PMD against own-feature domain
  boundaries.
- `repository/` and `query/` as exported adapter roles are enforced by Error
  Prone through own-feature domain contract presence, repository-versus-query
  contract role matching, public contract placement bans, and implementation
  placement for exported domain ports.
- `gateway/` as the concrete-source boundary is enforced by `build-harness`
  placement, PMD concrete-source API bans outside gateways, Error Prone
  public/protected gateway return-type restrictions, and Error Prone exported
  adapter gateway-facade access.
- `model/` as source-local schema and carrier ownership is enforced by
  `build-harness` schema/table-name ownership, PMD DDL placement, ArchUnit
  independence from domain packages, and Error Prone bans on leaking internal
  model types through public adapter signatures.
- `mapper/` as translation-only code is mechanically enforced only for source
  mechanics placement through PMD; semantic normalization and validation
  meaning remains review-owned.
- `persistencecore/` is enforced as shared infrastructure by `build-harness`
  placement, ArchUnit independence from feature-specific data packages and
  domain packages, and Error Prone signature-leak checks when adapters expose
  internal persistencecore types.
- Cross-layer and cross-feature forbidden patterns are enforced through ArchUnit
  for view/shell/bootstrap independence, foreign-domain public seams, data
  feature cycle freedom, and foreign private data bucket bans.

`Review-Only`:

- Semantic thinness of `*ServiceContribution` beyond root-shape and registration
  checks.
- Business-rule, invariant, ranking-policy, and presentation-policy exclusion
  from `src/data/**` when it is not visible as stable source tokens,
  dependencies, or signatures.
- Whether `repository/` and `query/` remain semantically limited to exported
  domain-port adapter roles beyond the encoded contract presence, contract
  role, public boundary placement, and gateway-facade checks.
- Whether `gateway/` internals remain feature-private in the stronger semantic
  sense beyond Java-visible public/protected return types and direct adapter
  collaborator references.
- Whether `model/` types are truly source-local data shapes rather than domain
  entities beyond the domain-dependency and public-signature leak bans.
- Whether mappers only translate rather than normalize or validate with domain
  meaning.
- Generic-only discipline for `persistencecore/` beyond package dependency and
  signature-leak checks.
- Duplicate schema truth outside exact table-name literals and mechanically
  stable DDL placement checks.

## System Layer

`Enforced`:

- Pattern alignment is enforcement context, not a separate blocker. The
  concrete Clean/Onion/Hexagonal/Service-Layer implications below are the
  enforceable rule set.
- `system-layer-topology`: active Java source roots and package-path alignment
  must stay under `bootstrap/`, `shell/api`, `shell/host`, `src/view`,
  `src/domain`, or `src/data` through `build-harness` rules `root-layout`,
  `src-layout`, `shell-layout`, `view-layout`, `domain-layout`,
  `data-layout`, `package-declaration`, and `package-path-match`
  (`:build-harness:check`).
- `system-top-level-inward-dependency-direction`: `bootstrap`, `shell`,
  `src.view`, `src.domain`, and `src.data` dependency direction through
  `ArchUnit` rules `bootstrapMustStayOutsideFeatureCode`,
  `bootstrapMustOnlyUseAppShellFromShellHost`,
  `shellMustNotReachFeatureInteractorsDomainOrData`,
  `shellMustStayIndependentFromBootstrap`, `viewMustNotReachBootstrapOrData`,
  `domainMustStayIndependentFromOuterLayers`,
  `dataMustNotReachBootstrapOrPresentation`, and
  `dataMustNotReachPresentationShellOrBootstrap` (`architectureTest`).
- `system-domain-no-outer-layer`: domain code must not depend on `bootstrap`,
  `shell`, `src.view`, or `src.data` via `ArchUnit` (`architectureTest`).
- `system-view-no-data-shortcut` and
  `system-view-domain-public-boundary-only`: view code may not reach
  `bootstrap/**` or `src.data/**`, and may depend on domain only through
  application-service roots and public `api/` carriers through `ArchUnit`
  rules `viewMustNotReachBootstrapOrData` and
  `viewImplementationMustOnlyUseDomainRootsAndApis` (`architectureTest`) plus
  the view-layer `Error Prone` checks (`compileJava`).
- `system-data-no-presentation-or-shell-shortcut`: internal data packages must
  not depend on `src.view`, `shell`, or `bootstrap`; data roots must not
  depend on `bootstrap` or `src.view`; and the data-root shell API subset is
  enforced by `ArchUnit` rules `dataMustNotReachBootstrapOrPresentation` and
  `dataMustNotReachPresentationShellOrBootstrap` (`architectureTest`) plus
  `Error Prone` `FeatureShellApiAllowlist` (`compileJava`).
- `system-data-domain-boundary-only-for-foreign-features`: foreign domain
  feature access from below the view layer must go through public domain seams
  through `ArchUnit` `dataFeaturesMustOnlyUseForeignFeatureApis`
  (`architectureTest`). Same-feature data adapter references to domain-owned
  repository and read-model/query contracts are constrained by
  `DataAdapterRoleContract` (`compileJava`) and backend-port placement checks
  in `build-harness` (`:build-harness:check`).
- `system-shell-passive-dependency-direction` and
  `system-shell-api-host-split`: shell code must not depend on feature layers,
  shell code must stay independent from `bootstrap`, `shell.api/**` must not
  depend on host or feature layers, non-bootstrap code must not reach
  `shell.host/**`, and bootstrap may use only `shell.host.AppShell` from the
  host package through `ArchUnit` (`architectureTest`).
- `system-bootstrap-and-shell-generic-wiring`: bootstrap and shell source must
  not name concrete `src.view`, `src.domain`, or `src.data` feature packages
  via `PMD architecture` (`pmdArchitectureMain`).
- `system-shell-runtime-seam-placement`: feature-facing shell API use is
  currently limited to view roots and data `*ServiceContribution` roots
  through `Error Prone` (`compileJava`) and PMD root-contract checks
  (`pmdArchitectureMain`).
- `system-service-contribution-placement`: service contribution roots are
  allowed only at the shell API contract and data feature roots via
  `build-harness` (`:build-harness:check`).
- `system-service-registry-registration-placement`: direct runtime service
  registrations into `ServiceRegistry.Builder` are allowed only in data
  `*ServiceContribution` roots via `Error Prone` (`compileJava`).
- `system-domain-boundary-carrier-purity`: public domain application-service
  and `api/` signatures must not leak outer-layer, foreign private domain, or
  same-feature internal domain-module types via `Error Prone` (`compileJava`).
- `system-data-boundary-carrier-purity`: public/protected gateway return types
  must not expose domain-facing return types, and public/protected
  repository/query adapter signatures must not leak internal data
  infrastructure types via `Error Prone` (`compileJava`).
- `system-view-boundary-carrier-purity`: declared Shared View Component
  `api/` packages are the only public view-to-view boundary; private foreign
  view buckets are blocked by jQAssistant and compiler-precise view dependency
  rules.
- `system-foreign-private-bucket-bans`: cross-feature access to private view,
  domain, and data buckets is blocked by the owning view, domain, and data
  rule sets through `jQAssistant`, `ArchUnit`, and `Error Prone`.

`Review-Only`:

- Pattern alignment quality beyond the concrete blockers, semantic layer
  responsibility boundaries, minimizing seams to the smallest intentional
  public boundary, removing needless pass-through wrappers without widening
  private access, distinguishing semantic boundary carriers from
  structurally simple types, deciding whether same-feature data-domain
  references are genuinely required by the adapter role, preserving shell
  passivity beyond dependency direction, validating runtime-control-flow
  intent, validating bootstrap discovery flow beyond structural generic-wiring
  bans, and keeping cross-layer coordination authored once instead of
  duplicated across shell, view, domain, and data.

## Passive Workbench Shell

`Enforced`:

- `shell-api-public-surface-allowlist`: `shell/api` may expose only the fixed
  passive workbench contract files through `build-harness`
  (`:build-harness:check`).
- `shell-api-host-split` and `shell-host-passivity-dependency-direction`:
  shell code must not depend on feature layers, `shell.api/**` must not depend
  on host or feature layers, non-bootstrap code must not reach `shell.host/**`,
  and bootstrap may use only `shell.host.AppShell` from the host package
  through `ArchUnit` (`architectureTest`).
- `shell-runtime-context-api-shape`: `ShellRuntimeContext` exposes only the
  fixed runtime gateway methods `inspector()`, `services()`, and `session(...)`
  through PMD `SaltMarcherSourcePolicyRule` (`pmdArchitectureMain`).
- `shell-feature-facing-api-allowlist`: view roots, transitional view
  `assembly/`, and data service roots may use only their documented shell API
  subsets through Error Prone `FeatureShellApiAllowlist` (`compileJava`).
- `shell-view-root-delegation-boundary`: current transitional checks require
  view roots to delegate `createScreen(...)` into own-feature `assembly/` and
  block direct runtime lookup, JavaFX construction, domain/data wiring, or
  private view composition through Error Prone `ViewRootDelegation`
  (`compileJava`).
- `shell-service-registry-registration-placement`: direct
  `ServiceRegistry.Builder.register(...)` calls must stay in data feature
  `*ServiceContribution` roots through Error Prone
  `ServiceRegistryRegistrationPlacement` (`compileJava`).
- `shell-fixed-slot-api`, `shell-contribution-spec-family`,
  `shell-contribution-spec-metadata-purity`,
  `shell-contribution-spec-api-shape`, `shell-screen-api-shape`,
  and `shell-details-inspector-only` are enforced through PMD
  `SaltMarcherSourcePolicyRule` (`pmdArchitectureMain`).
- `shell-screen-lifecycle-hook-ownership`: `ShellScreen.onShow()` and
  `ShellScreen.onHide()` may be invoked only by `shell.host.AppShell` through
  Error Prone `ShellLifecycleHookOwnership` (`compileJava`).

Runtime guards outside the build-blocking harness:

- `AppShell` routes contribution registration through `ShellSlotValidator`, so
  invalid `ShellContributionSpec` to `ShellScreen.slotContent()` mappings are
  rejected at shell-registration time. This protects the full dynamic slot
  matrix but is not classified as a build-blocking harness owner because
  `slotContent()` is runtime factory output.

`Review-Only`:

- Full workbench role vocabulary, whether `AppShell` remains passive beyond
  dependency direction, semantic feature/business-logic exclusion from shell
  host code, lazy-realization readiness, `ShellScreen` as legacy API naming
  rather than a universal navigable-screen concept, contribution-spec-to-slot
  semantics beyond runtime validation, open-ended named-region composition
  risks that do not introduce a new static API surface, and the semantic
  remainder of feature-specific alternate wiring paths around
  `ShellRuntimeContext`.

## Shell Discovery And Bootstrap

`Enforced`:

- `shell-view-root-discovery-contract`: view contribution roots are found only
  at `src/view/<component>/<PascalComponentName>ViewContribution.java` through
  `jQAssistant` `saltmarcher:MvvmRootOnlyViewContribution` and
  `saltmarcher:MvvmViewRootEntrypointCount` (`checkViewArchitecture`),
  `build-harness` `shell-view-contribution-placement`
  (`:build-harness:check`), and PMD `SaltMarcherEntrypointRule`
  (`pmdArchitectureMain`).
- `shell-service-root-discovery-contract`: service contribution roots are found
  only at `src/data/<feature>/<PascalFeatureName>ServiceContribution.java`
  through `build-harness` `persistence-root-entrypoint` and
  `service-contribution-placement` (`:build-harness:check`) plus PMD
  `SaltMarcherEntrypointRule` (`pmdArchitectureMain`).
- `shell-root-instantiation-contract`: view and service contribution roots must
  be concrete `public final` classes with public no-arg constructors,
  required root methods, stateless shape, and no extra public/protected members
  through PMD `SaltMarcherEntrypointRule` (`pmdArchitectureMain`).
- `shell-supported-contribution-spec-selection`: view roots construct exactly
  one supported shell contribution spec and `defaultLanding` appears only on
  `ShellTabSpec` roots through PMD `SaltMarcherEntrypointRule`
  (`pmdArchitectureMain`).
- `shell-startup-default-landing-uniqueness`: root `ShellTabSpec` metadata must
  use literal `defaultLanding` values and at most one tab may declare
  `defaultLanding=true` through `build-harness`
  `shell-tab-default-landing-literal` and `shell-default-landing-uniqueness`
  (`:build-harness:check`).
- `shell-generic-bootstrap-wiring`: bootstrap and shell code must not name
  concrete feature packages through PMD `SaltMarcherSourcePolicyRule`
  (`pmdArchitectureMain`), while shell passivity, the `shell.api` /
  `shell.host` split, and bootstrap-only `shell.host.AppShell` access are
  enforced through `ArchUnit` (`architectureTest`).

`Review-Only`:

- The exact application-classloader scan mechanics, reflection error wording,
  ignored interface/abstract roots, service-before-view sequencing, shell
  construction sequencing, registration-by-spec dispatch, key-sort
  registration order, startup fallback ordering, eager current realization,
  minimal public seams, pass-through wrapper redundancy, and cross-layer
  coordination ownership when those judgments are semantic or
  runtime-flow-dependent rather than package-visible. Passive workbench shell
  contract and runtime-seam coverage is classified in the Passive Workbench
  Shell section above.

## Styling

`Enforced`:

- `styling-inline-setstyle-ban`: active application code under `bootstrap/`,
  `shell/`, and `src/` must not use inline JavaFX `setStyle(...)` calls via
  PMD `SaltMarcherSourcePolicyRule` (`pmdArchitectureMain`).
- `styling-centralized-stylesheet-placement`: stylesheet files with supported
  stylesheet extensions must live directly under top-level `resources/` via
  Gradle `CheckCentralizedStylesheetsTask` (`checkCentralizedStylesheets`).
- `styling-central-selector-definition`: Java-authored style class selectors
  must resolve to selectors in centralized `resources/*.css` files via Gradle
  `CheckDefinedStyleClassSelectorsTask` (`checkDefinedStyleClassSelectors`).
  The mechanical scope is direct `getStyleClass()` string literals plus
  string-literal selector arguments passed through recognized helper methods
  that forward parameters into `getStyleClass()`.
- `styling-no-programmatic-visual-styling`: active application code outside
  `src/view/mapcanvas/View/**` must not author visual styling through JavaFX
  paint, font, border, background, shape-paint, text-paint, or direct canvas
  styling APIs via Error Prone `ViewProgrammaticStyling` (`compileJava`).

`Review-Only`:

- Whether a newly introduced selector is genuinely shared presentation
  vocabulary rather than needless one-off naming remains review-owned even
  when the selector is centrally defined and mechanically resolvable.
- Runtime-computed selector names that are not visible as Java string literals
  remain review-owned unless a future stable checker can resolve them without
  brittle whole-program heuristics.

## Repository Structure

`Enforced`:

- `repository-active-java-root-allowlist`: Java source files must stay under
  `bootstrap/`, `shell/`, `src/`, `test/`, `tools/`, or legacy
  `salt-marcher/` via `build-harness` (`:build-harness:check`).
- `repository-src-direct-child-allowlist`: non-empty direct children of
  `src/` must be `view/`, `domain/`, or `data/` via `build-harness`
  (`:build-harness:check`).
- `repository-included-build-taxonomy`: Gradle included builds must live under
  `tools/gradle/` or `tools/quality/` via `build-harness`
  (`:build-harness:check`).
- `repository-production-source-layout`: production Java package roots,
  `shell/api` and `shell/host`, `src/view`, `src/domain`, and `src/data`
  placement, plus package-path alignment, are enforced by `build-harness`
  rules `root-layout`, `src-layout`, `shell-layout`, `view-layout`,
  `domain-layout`, `data-layout`, `package-declaration`, and
  `package-path-match` (`:build-harness:check`).
- `repository-view-feature-layout`: current view component root-only placement
  and transitional `assembly/`, optional `api/`, `View/`, and `ViewModel/`
  buckets are enforced by `jQAssistant` MVVM rules and PMD root contracts
  (`checkViewArchitecture`, `pmdArchitectureMain`).
- `repository-domain-feature-layout`: domain root application-service
  presence, direct `api/` and `application/` allowances, named-module package
  shape, role-bucket bans, backend-port placement, and required context markers
  are enforced by `build-harness` (`:build-harness:check`).
- `repository-data-feature-layout`: data root service-contribution presence,
  allowed `repository/`, `query/`, `gateway/local/`, `gateway/remote/`,
  `model/`, `mapper/`, and `persistencecore/` placement, schema declaration
  presence, and schema table-name ownership are enforced by `build-harness`
  (`:build-harness:check`).
- `repository-resource-layout`: active stylesheet files must live directly
  under `resources/` via `checkCentralizedStylesheets`, and Java-authored style
  classes must resolve to centralized selectors via
  `checkDefinedStyleClassSelectors`.

`Review-Only`:

- The root layout diagram is not a complete allowlist for every repository
  support surface; standard Gradle, GitHub Actions, tests, generated outputs,
  and tool-reference material remain governed by their owning standards and
  review.
- `docs/compat/**` staying deprecated compatibility stubs, documentation
  source-of-truth conflicts, and same-change documentation update expectations
  remain documentation-governance review responsibilities unless a future docs
  gate explicitly expands the blocker model.
- Semantic role quality behind allowed feature buckets remains owned by the
  view, domain, data, shell, and system standards rather than by repository
  topology checks.

## References

- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1)
