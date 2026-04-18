Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Mechanical ownership, execution model, rule-status vocabulary,
and review-only boundary for build-blocking architecture enforcement on active
code surfaces.

# Architecture Enforcement Harness Standard

## Goal

SaltMarcher uses one explicit mechanical enforcement harness for architecture
rules on active code surfaces.

The harness exists to answer four questions without ambiguity:

- which documented rules are mechanically enforced today
- which engine owns each mechanically enforced rule
- through which blocking task a violation breaks local quality
- which documented rules remain intentionally review-owned

This standard defines the harness model itself. It does not replace the layer
standards as the source of architectural intent, and it does not replace
`quality-platforms.md` as the operating guide for tasks and GitHub Actions.

## Scope

The harness covers active code and build-owned resource surfaces:

- `bootstrap/**`
- `shell/**`
- `src/view/**`
- `src/domain/**`
- `src/data/**`
- `resources/**` where a rule is enforced by a build-owned verifier
- Gradle-owned repository policy surfaces that directly guard those code models

This standard does not make documentation or agent-instruction artifacts part
of the blocker model. Those surfaces remain governed by their own standards and
review rules unless a future explicit decision expands the harness scope.

## Core Principles

- A mechanically enforced rule has exactly one primary mechanical owner.
- Ownership is assigned by rule shape, not by historical placement, temporary
  convenience, or tool availability bias.
- A rule may be documented in a layer standard, but it may only be described as
  mechanically enforced when this standard names both the owner and the
  blocking task.
- A review-only rule is still binding architecture guidance. The absence of a
  gate is not permission to ignore it.
- Blocking rules must stay locally reproducible, deterministic enough for daily
  use, and precise enough that developers can identify the offending surface
  without interpretive archaeology.
- The harness must prefer established owners already present in the repository
  over introducing new engines for marginal gain.
- When a superseding architecture standard outruns an older mechanical check,
  the standard remains the canonical source of truth and the check must be
  documented as migration debt rather than treated as the real architecture
  model.

## Rule Status Vocabulary

Every architecture rule named in a standard belongs to exactly one status:

- `Enforced`
  A primary owner and blocking task are named here, and the rule is expected to
  fail local quality when violated.
- `Candidate`
  The rule is intended for future mechanical ownership, but SaltMarcher has not
  yet accepted a stable blocker for it. Candidate rules are not described as
  already enforced.
- `Review-Only`
  The rule is binding architecture guidance that currently relies on review,
  manual inspection, or targeted design judgment rather than a blocking gate.

Layer standards should use `Verification Notes`, `Enforcement Notes`, or
`Review-Only Rules` sections to summarize the rule status relevant to that
layer, while this document remains the canonical source for the shared status
model.

## Rule Shape Taxonomy

SaltMarcher assigns mechanical ownership by the dominant shape of the rule.

### Repository Topology And Presence Rules

These rules are defined by file placement, allowed buckets, package-path
alignment, or the presence of required roots and schema declarations.

Examples:

- allowed top-level and feature-level directories
- one required root entrypoint per feature root
- one required persistence schema per persistence-exporting data feature
- bans on harness selftests and fixture-based meta-verification

### Source Policy Rules

These rules inspect Java source structure, naming, required methods, and
forbidden textual or AST-local usage patterns without needing full compiler
type resolution across public signatures.

Examples:

- root entrypoint contracts
- shell contribution spec selection and thin stateless root-surface rules
- inline styling bans
- legacy shell or runtime-service wiring bans

### Compiler-Precise Rules

These rules require javac-resolved types, signature visibility, or precise
referenced-type analysis.

Examples:

- public signature leaks from private view buckets
- framework independence of `ViewModel/`
- direct `ShellRuntimeContext` bypasses below the allowed boundary

### Bytecode Dependency Rules

These rules are about package-level dependency direction, boundary crossing,
and cycles visible after compilation.

Examples:

- `domain` independence from outer layers
- cross-feature access through foreign application-service and `api/`
  boundaries only
- package or feature cycle bans

### Graph Topology Rules

These rules are whole-slice or whole-codebase structural constraints that are
most naturally expressed as graph queries rather than per-file checks.

Examples:

- canonical MVVM bucket topology
- cross-component public-boundary rules in `src/view/**`
- root-entrypoint count per view component

### Gradle-Owned Build And Resource Rules

These rules are repository policy checks expressed most naturally as typed
Gradle verification tasks over files, resources, or packaging metadata.

Examples:

- centralized stylesheet placement
- compiled artifact bans in source roots
- desktop packaging inputs required by the application build

## Mechanical Owners

### `build-harness`

`build-harness` owns repository-topology and presence rules whose truth is most
directly expressed from the file tree.

It is the default owner for:

- repository layout and package-path alignment
- feature-root presence rules
- allowed bucket names where the rule is fundamentally topological
- persistence schema contracts and similar code-surface presence rules
- bans on fixture-based selftests inside verification harnesses

It is not the owner for dependency direction, compiler-resolved signature
checks, or graph-shaped view topology.

### `PMD architecture`

`PMD architecture` owns source policy rules that are best expressed as Java
source conventions and forbidden usage patterns.

It is the default owner for:

- root entrypoint naming and constructor contracts
- required root methods
- thin stateless contribution-root contracts and minimal root public surfaces
- shell contribution spec selection
- inline styling bans
- domain source bans on UI or infrastructure framework tokens
- legacy wiring type bans already modeled at source level

It is not the owner for graph topology, full compiler-signature checks, or
package dependency direction.

### `Error Prone`

`Error Prone` owns compiler-precise source rules that need javac-resolved type
information or public-signature awareness.

It is the default owner for:

- compiler-precise MVVM dependency bans
- `ViewModel/` framework independence
- feature-facing shell API allowlists on view composition boundaries
- public domain-boundary signature purity against outer-layer and foreign
  private domain leaks
- presentation-state placement and naming bans that depend on resolved type use
- programmatic visual-styling bans outside documented rendering exceptions
- reflection-bypass bans in `src/view/**`
- public API signature leaks from private view buckets

It is not the owner for repository topology or broad package graph rules.

### `ArchUnit`

`ArchUnit` owns bytecode-visible dependency direction, foreign-boundary access,
and cycle rules.

It is the default owner for:

- top-level layer dependency direction
- domain and data foreign-feature access constraints
- cycle freedom across domain features, view components, data features, and
  shell packages

It is not the owner for file-tree topology, root method contracts, or compiler-
precise public-signature bans.

### `jQAssistant`

`jQAssistant` owns graph-shaped architecture rules, especially where the
canonical model spans multiple buckets and source files.

It is the default owner for:

- canonical MVVM bucket topology
- view-component root count
- graph-shaped cross-component boundary restrictions
- bucket placement rules such as `assembly`-only wiring types

It is not the owner for general domain or data topology, nor for compiler-
precise signature and framework checks that produce better diagnostics inside
`compileJava`.

### Gradle-Owned Verification Tasks

Typed Gradle verification tasks in the build logic own repository-wide build
and resource policies that are neither language-level architecture rules nor
external platform reports.

They are the default owner for:

- centralized stylesheet placement
- centralized style-class selector definition checks
- bans on compiled artifacts in active source roots
- packaging metadata and required build resources

## Execution Model

The harness uses existing blocking entrypoints. It does not define a new
mandatory top-level gate name.

### First Blocking Entry Point

- `./gradlew compileJava`
  This is the earliest blocking entrypoint for compiler-resolved view and data
  architecture. It runs `Error Prone` and then finalizes with the canonical
  `jQAssistant` MVVM blocker after successful compilation.

### Explicit View-Architecture Entry Point

- `./gradlew checkViewArchitecture`
  This is the explicit reporting entrypoint for the canonical graph-shaped MVVM
  blocker.

### Explicit Non-View Architecture Aggregate

- `./gradlew checkArchitecture`
  This aggregates:
  - `architectureTest`
  - `pmdArchitectureMain`
  - `:build-harness:check`

### Local Full Blocker

- `./gradlew check`
  This is the local blocking aggregate for the architecture harness plus
  adjacent blocking quality gates wired into the repository.

### Explicit Gradle-Owned Resource Entry Points

- `./gradlew checkCentralizedStylesheets`
  This is the primary blocking entrypoint for centralized stylesheet placement.
- `./gradlew checkDefinedStyleClassSelectors`
  This is the primary blocking entrypoint for Java-authored style classes that
  must resolve to centralized selectors in `resources/*.css`.
- `./gradlew checkNoCompiledArtifactsInSource`
  This is the primary blocking entrypoint for compiled-artifact bans in active
  source roots.
- `./gradlew checkDesktopPackagingInputs`
  This is the primary blocking entrypoint for required desktop packaging
  resources and metadata.

`check` is broader than the architecture harness. It also runs quality gates
such as duplicate detection or complexity verification that are important for
local blocking quality but are not the primary owner of a layer-model rule.

## Coverage Matrix By Surface

### View Layer

- `Enforced`
  - `view-topology-allowlist`: only `assembly/`, optional `api/`, `View/`,
    and `ViewModel/` may appear as canonical view buckets via `jQAssistant`
    (`checkViewArchitecture`, `compileJava`)
  - `view-legacy-bucket-ban`: `Model/`, `Controller/`, and `interactor/`
    remain forbidden migration-debt buckets via `jQAssistant`
    (`checkViewArchitecture`, `compileJava`)
  - `view-root-only-view-contribution`: component roots may host only
    `*ViewContribution` types via `jQAssistant`
    (`checkViewArchitecture`, `compileJava`)
  - `view-root-count`: every component exposes exactly one root
    `*ViewContribution` via `jQAssistant`
    (`checkViewArchitecture`, `compileJava`)
  - `view-assembly-naming-placement`: `*Assembly` and `*ShellAdapter` types
    belong in `assembly/` via `jQAssistant`
    (`checkViewArchitecture`, `compileJava`)
  - `view-cross-component-public-api-only`: cross-component view dependencies
    may target only foreign `api/` packages via `jQAssistant`
    (`checkViewArchitecture`, `compileJava`)
  - `view-root-contracts`: root naming, `public final`, public no-arg
    constructor, implemented shell interface, and required root methods via
    `PMD architecture` (`pmdArchitectureMain`)
  - `view-root-delegation-boundary`: root entrypoints must delegate slice
    wiring into `assembly/`; direct JavaFX, domain, data, private-view,
    inline-`ShellScreen`, and `ShellRuntimeContext.inspector()` /
    `services()` / `session(...)` usage are forbidden via `Error Prone`
    (`compileJava`)
  - `view-shell-api-allowlist`: view roots and `assembly/` may reference only
    the documented feature-facing shell API surface via `Error Prone`
    (`compileJava`)
  - `view-assembly-dependency-boundary`: `assembly/` may compose only own MVVM
    buckets, foreign `api/`, and domain public boundaries; data access is
    forbidden via `Error Prone` (`compileJava`)
  - `view-rendering-boundary`: `View/` packages may depend only on own
    `View/` + `ViewModel/` and foreign `api/`; shell, domain, and data access
    is forbidden via `Error Prone` (`compileJava`)
  - `view-viewmodel-framework-independence`: `ViewModel/` stays free of
    `javafx.*`, `shell.*`, `src.data.*`, own `View/` / `assembly/`, and
    foreign private view buckets via `Error Prone` (`compileJava`)
  - `view-api-dependency-boundary`: `api/` packages must stay free of shell,
    domain, data, and foreign private view dependencies via `Error Prone`
    (`compileJava`)
  - `view-presentation-state-placement`: presentation-state carrier types stay
    in `ViewModel/` or explicit `api/` via `Error Prone` (`compileJava`)
  - `view-reflection-bypass-ban`: `src/view/**` must not bypass architecture
    boundaries via reflective type lookup via `Error Prone` (`compileJava`)
  - `view-api-signature-no-private-leaks`: public `api/` signatures must not
    leak private view bucket types via `Error Prone` (`compileJava`)
- `Review-Only`
  - deeper semantic ownership of cross-widget presentation decisions
  - runtime callback-flow semantics that cannot be expressed as stable source
    or graph rules today

### Domain Layer

- `Enforced`
  - `domain-root-presence`: every domain feature exposes exactly one
    `*ApplicationService` root via `build-harness` (`:build-harness:check`)
  - `domain-structural-allowlist`: only `api/`, `application/`, named domain
    modules, and explicitly tolerated legacy root role buckets may appear
    directly under `src/domain/<feature>/`, with `services/` forbidden, via
    `build-harness` (`:build-harness:check`)
  - `domain-outer-layer-independence`: `src/domain/**` must not depend on
    `src/view/**`, `shell/**`, `bootstrap/**`, or `src/data/**` via
    `ArchUnit` (`architectureTest`)
  - `domain-foreign-feature-public-seams-only`: below the view layer, domain
    code may reach foreign domain features only through foreign
    `*ApplicationService` roots and foreign `api/` carriers via `ArchUnit`
    (`architectureTest`)
  - `domain-framework-and-infra-leakage`: domain sources must not reference UI
    and infrastructure framework tokens via `PMD architecture`
    (`pmdArchitectureMain`)
  - `domain-root-no-direct-infra-composition`: root application services must
    not instantiate or cache repository/query/gateway/store infrastructure
    directly via `PMD architecture` (`pmdArchitectureMain`)
- `Candidate`
  - `domain-ddd-target-topology-only`: stop tolerating legacy root role
    buckets in `build-harness` once the migration debt is retired; preferred
    owner remains `build-harness` on `:build-harness:check`
- `Review-Only`
  - object-centred placement quality
  - named-module cohesion and ubiquitous-language module naming
  - aggregate-root-only mutation semantics
  - one-aggregate-per-transaction as a modeling judgment
  - whether a feature is classified explicitly in `DOMAIN.md`
  - whether a declared feature classification is substantively correct

### Data Layer

- `Enforced`
  - `data-layout`: allowed data buckets, data-root placement, and
    `persistencecore/` bucket placement via `build-harness`
    (`:build-harness:check`)
  - `persistence-root-entrypoint`: exactly one
    `<PascalFeatureName>ServiceContribution.java` per non-`persistencecore`
    data feature via `build-harness` (`:build-harness:check`)
  - `persistence-schema-contract`: the current stricter schema-entrypoint
    blocker, which requires exactly one `*PersistenceSchema` under every
    current non-`persistencecore` data feature, via `build-harness`
    (`:build-harness:check`)
  - `data-root-contracts`: root naming, `public final`, public no-arg
    constructor, implemented shell interface, required
    `register(ServiceRegistry.Builder)`, no instance fields, and no additional
    public/protected members via `PMD architecture` (`pmdArchitectureMain`)
  - `data-root-registration-boundary`: `*ServiceContribution` roots may
    register only own-feature domain boundary types into `ServiceRegistry` via
    `PMD architecture` (`pmdArchitectureMain`)
  - `data-outer-layer-independence`: internal data packages must not depend on
    view, shell, or bootstrap via `ArchUnit` (`architectureTest`)
  - `data-foreign-domain-public-seams-only`: internal data packages may reach
    foreign domain features only through foreign public seams via `ArchUnit`
    (`architectureTest`)
  - `data-cross-feature-private-bucket-ban`: data features must not depend on
    foreign private data buckets via `ArchUnit` (`architectureTest`)
  - `data-feature-cycle-freedom`: data features must stay cycle-free via
    `ArchUnit` (`architectureTest`)
  - `persistencecore-feature-independence`: `persistencecore/` must stay free
    of feature-specific data packages via `ArchUnit` (`architectureTest`)
  - `persistencecore-domain-independence`: `persistencecore/` must stay free of
    domain dependencies via `ArchUnit` (`architectureTest`)
  - `data-gateway-return-boundary`: public/protected gateway methods must not
    expose domain return types via `Error Prone` (`compileJava`)
  - `data-adapter-signature-no-internal-leaks`: public/protected repository and
    query adapter signatures must not leak `model/`, `gateway/`, or
    `persistencecore` internal infrastructure types via `Error Prone`
    (`compileJava`)
- `Review-Only`
  - semantic thinness of `*ServiceContribution` beyond the mechanically encoded
    root-shape checks
  - `repository/` and `query/` as the only exported adapter boundaries in the
    stronger semantic sense
  - business-rule exclusion from `src/data/**`
  - feature-private gateway containment in the stronger semantic sense
  - the semantic remainder of generic-only discipline for `persistencecore/`
  - duplicate schema truth staying out of scattered helper classes and string
    constants

### Shell Discovery And Workbench Boundaries

- `Enforced`
  - view-contribution and service-contribution root naming, placement, and
    presence via the combined current owner set of `build-harness` and
    `PMD architecture`
  - root constructor contracts, thin stateless root contracts, and supported
    contribution-spec selection via `PMD architecture`
  - top-level shell and bootstrap dependency direction, the `shell.api` /
    `shell.host` package split, and the bootstrap-only access rule for
    `shell.host.AppShell` via `ArchUnit`
  - the currently encoded subset of root-to-assembly delegation in
    `src/view/**` via `Error Prone`, including direct root wiring to JavaFX,
    domain, data, private view buckets, inline `ShellScreen` construction, and
    root use of `ShellRuntimeContext.inspector()` / `services()` /
    `session(...)`
  - the documented feature-facing shell API surface for view roots,
    `assembly/`, and data `*ServiceContribution` roots via `Error Prone`
    (`compileJava`)
- `Review-Only`
  - slot-matrix correctness as a source-level rule; current blocking ownership
    stays at runtime through `ShellSlotValidator`
  - lazy-realization readiness of contribution roots
  - contribution-spec types staying pure registration metadata rather than
    becoming a home for feature logic or runtime lookup
  - the full workbench role vocabulary
  - lifecycle semantics beyond the current encoded hook and slot contracts
  - bans on open-ended named-region composition and manual bootstrap feature
    registries as the default extension model
  - bans on feature-specific alternate wiring paths around
    `ShellRuntimeContext` beyond the mechanically encoded subset

### Repository Structure And Styling

- `Enforced`
  - repository topology and package-path alignment via `build-harness`
  - `styling-inline-setstyle-ban`: active application code under `bootstrap/`,
    `shell/`, and `src/` must not use `setStyle(...)` via
    `PMD architecture` (`pmdArchitectureMain`)
  - `styling-no-programmatic-visual-styling`: active application code outside
    `src/view/mapshared/View/**` must not author visual styling through
    JavaFX paint, font, border, background, or direct canvas styling APIs via
    `Error Prone` (`compileJava`)
  - `styling-centralized-stylesheet-placement`: stylesheet files for active
    code must live directly under `resources/` via Gradle-owned verification
    tasks (`checkCentralizedStylesheets`)
  - `styling-central-selector-definition`: Java-authored style classes must
    resolve to selectors defined in centralized `resources/*.css` files via
    Gradle-owned verification tasks (`checkDefinedStyleClassSelectors`)
  - compiled-artifact bans in active source roots via Gradle-owned verification
    tasks (`checkNoCompiledArtifactsInSource`)
  - desktop packaging inputs required by the application build via
    Gradle-owned verification tasks (`checkDesktopPackagingInputs`)
- `Review-Only`
  - whether a newly introduced selector is genuinely shared presentation
    vocabulary rather than a one-off name

### System Layer And Cross-Layer Seams

- `Enforced`
  - top-level inward dependency direction between `bootstrap`, `shell`,
    `src/view`, `src/domain`, and `src/data` via `ArchUnit`
    (`architectureTest`)
  - view access to backend boundaries only through public
    `*ApplicationService` roots and public `api/` carriers via the combined
    current owner set of `ArchUnit` (`architectureTest`) and `Error Prone`
    (`compileJava`)
  - shell usage confined to view contribution roots and `assembly/` via the
    combined current owner set of `Error Prone` (`compileJava`) and
    `ArchUnit` (`architectureTest`)
  - shell usage confined to data `*ServiceContribution` roots by the combined
    current owner set of `Error Prone` (`compileJava`), `ArchUnit`
    (`architectureTest`), `PMD architecture` (`pmdArchitectureMain`), and
    `build-harness` (`:build-harness:check`)
  - `shell.api` as the only feature-facing shell boundary below `bootstrap/`
    and the bootstrap-only access rule for `shell.host.AppShell` via
    `ArchUnit` (`architectureTest`)
  - `domain-public-boundary-no-outer-or-foreign-private-signature-leaks`:
    public domain boundary signatures must stay free of outer-layer types and
    foreign private domain types via `Error Prone` (`compileJava`)
  - the structurally expressible subset of boundary-carrier purity via the
    combined current owner set of `PMD architecture`, `ArchUnit`, and
    `Error Prone`
- `Candidate`
  - `domain-public-boundary-same-feature-internal-carrier-purity`: same-feature
    internal domain types should eventually disappear from public backend
    boundary signatures once the remaining migration debt is retired; the
    preferred future owner remains `Error Prone` on `compileJava`
- `Review-Only`
  - minimizing seams to the smallest intentional public boundary when a
    structurally legal wider dependency would still be unnecessary
  - banning adjacent-layer-only pass-through wrappers whose redundancy depends
    on behavioral intent rather than stable structure alone
  - preserving shell passivity and composition-root discipline beyond the
    encoded structural checks
  - keeping coordination logic authored once instead of duplicated across
    shell, view, domain, and data when the duplication is semantic rather than
    package-visible

## Diagnostic Contract

Every harness owner should emit diagnostics that make the violated contract
actionable.

The preferred diagnostic shape is:

- stable rule identifier or rule name
- offending source or repository location
- short statement of the expected architectural boundary
- short statement of the actual violating condition
- enough wording to guide a first repair without re-reading multiple standards

Where the engine allows it, diagnostics should use the canonical architecture
terms already present in the layer standards rather than tool-internal jargon.

## Rule Lifecycle

When SaltMarcher promotes a documented rule into the harness, the change should
follow one explicit lifecycle:

1. define the rule in the owning architecture standard
2. classify it as `Review-Only` or `Candidate` until a stable owner exists
3. identify the dominant rule shape
4. assign exactly one primary mechanical owner
5. wire the rule into an existing blocking task, or explicitly document why a
   new task is necessary
6. update this standard and the owning layer standard in the same change
7. only then describe the rule as `Enforced`

SaltMarcher should not describe aspirational future checks as if they already
block local quality.

## Review-Only Boundary

The harness intentionally does not attempt to mechanize every architectural
judgment.

Rules stay review-owned when one of the following is true:

- the rule depends on deep semantic intent rather than stable structural shape
- the likely false-positive cost is too high for a daily blocker
- the existing engines can express the rule only by obscuring the real
  violation behind brittle heuristics
- the rule is better treated as design review than as repository policy

When a layer standard names review-owned rules, that is a governance boundary,
not a backlog omission.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvvm.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/data-layer.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/styling.md:1)
- [ADR 003: Architecture Rule Ownership By Enforcement Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/003-architecture-rule-ownership.md:1)
- [ADR 006: Layered View-Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/006-jqassistant-owns-view-architecture-enforcement.md:1)
