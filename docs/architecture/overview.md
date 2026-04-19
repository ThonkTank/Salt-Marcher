Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: System-wide architecture summary and entry point into the
architecture documentation set.

# Architecture Overview

## Purpose

SaltMarcher is structured as a passive-shell JavaFX application with feature
slices under `src/`. The shell exposes registration contracts and fixed target
areas. Features provide UI contributions and shell-owned runtime capability
registration through those contracts instead of through feature-specific wiring
in bootstrap.

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive host shell and slot contracts
src/view/    presentation code by component with strict MVVM roles
src/domain/  domain logic by feature
src/data/    infrastructure adapters by feature
resources/   static resources and centralized stylesheets
docs/        architecture overview, standards, ADRs, references, and stubs
tools/       build infrastructure, quality platforms, and engineering scripts
```

## System Model

- `bootstrap/` creates the shell and discovers feature and service
  contributions generically.
- `shell/` owns passive workbench surfaces such as navigation, top bar,
  workspace hosting, inspector/details hosting, runtime-state hosting, and
  shared runtime-session state used by multiple contributions.
- `src/view/<component>/` owns presentation behavior and user interaction.
  The detailed role model, dependency rules, reuse boundary, and enforcement
  targets live only in the dedicated MVVM standard.
- `src/domain/<feature>/` owns business meaning, invariants, policy decisions,
  aggregates, application services, exported boundary types, and named domain
  modules inside one bounded context. The detailed DDD model, aggregate rules,
  supporting-read-model exception, and enforcement targets live only in the
  dedicated domain-layer standard.
- `src/data/<feature>/` owns persistence and external-system adapters. The
  detailed role model, including data adapters for domain-owned repository and
  projection contracts, `gateway/` for internal source adapters, and shared
  infrastructure rules, live only in the dedicated data-layer standard.
- `src/data/persistencecore/` holds shared SQLite infrastructure reused by
  multiple persistence features without becoming an application-service
  boundary of its own.
- `tools/gradle/` owns included Gradle builds such as the convention plugin and
  build harness.
- `tools/quality/` owns quality-platform configuration, custom rule projects,
  jQAssistant rules, engineering helper scripts, and repo-owned Codex skills.
- `docs/standards/architecture-enforcement-harness.md` defines
  how the documented layer models map to mechanical owners, blocking tasks, and
  review-only boundaries.

Feature documentation follows the same ownership model. System-wide documents
stay in `docs/`, compatibility stubs live in `docs/compat/`, and feature
documents live next to the feature code they describe.

## Domain Context Map

- `creatures`: Supporting Read-Model Context. Exports creature catalog search,
  detail lookup, filter options, and encounter-candidate projections to
  downstream policy contexts. It does not own encounter balancing or creature
  write-model policy.
- `dungeon`: Policy-Owning Bounded Context. Owns authored dungeon-map truth,
  identity-preserving map mutation policy, derived-state rebuild rules, and
  repository contracts for persisted maps. It publishes map snapshots and
  summaries through its application-service and `api/` boundary.
- `encounter`: Policy-Owning Bounded Context with no persisted v1 write model.
  Consumes `party` and `creatures` through their application services and public
  API carriers, then owns runtime encounter balancing, candidate ranking, locks,
  and generated-encounter policy.
- `mapcore`: Supporting Read-Model Context. Exports topology-neutral map
  projection contracts shared by map-owning contexts. It does not own authored
  dungeon, travel, or map mutation policy.
- `party`: Policy-Owning Bounded Context. Owns party roster truth, membership,
  XP progression, rest cadence, and adventuring-day policy. Downstream contexts
  consume party state only through the party application-service and `api/`
  carriers.

## Dependency Direction

SaltMarcher uses a system-layer model with repository roots
`bootstrap`, `shell`, `view`, `domain`, and `data`.

Dependencies point inward toward the application core:

- bootstrap depends on shell contracts.
- view code reaches backend content through MVVM roles, shell composition, and
  domain application services.
- domain code owns business rules and domain-owned ports.
- data code implements domain-owned contracts and externalizes infrastructure
  details.

The shell must remain passive. It may define slots and registration contracts,
but it must not own feature logic.

Below the view layer, the only public client-facing backend boundary is a
feature's `*ApplicationService`. The shell-owned runtime registry remains a
composition seam used to assemble or obtain those application services and
other runtime capabilities; it is not a second public backend layer.

The detailed top-level layer responsibilities, public cross-layer seams,
boundary-crossing rules, and explicit root-only exceptions live only in the
dedicated system-layer standard.
The detailed shell workbench role model, fixed surface contract, lifecycle
expectations, and forbidden composition patterns live only in the dedicated
shell-workbench standard. Discovery, instantiation, registration order, and
startup resolution live only in the shell discovery/bootstrap standard.

## Registration Model

The application registers feature UI through shell contributions and exported
runtime capabilities through service contributions.

- `shell/api/ShellViewContribution` provides `ShellContributionSpec` and
  `ShellScreen`.
- `shell/api/ServiceContribution` registers typed backend capabilities and
  application-service factories into the shared shell service registry,
  `ServiceRegistry`.
- `shell/api/ShellRuntimeContext` provides shell-owned shared services such as
  runtime-capability lookup, inspector access, and per-shell runtime sessions.
- `*ViewContribution` remains a thin root that delegates routine shell-facing
  composition into `assembly/`.
- Bootstrap discovers both generically. Adding a feature should not require
  routine shell or bootstrap edits.

The view layer follows an MVVM model with:

- shell composition in `assembly/`
- presentation state and actions in `ViewModel/`
- scene-graph ownership in `View/`
- optional public cross-component reuse through `api/`

Detailed rules live only in the dedicated MVVM standard.

## Presentation Styling

JavaFX styling is centralized under `resources/`.

- Active code under `bootstrap/`, `shell/`, and `src/` expresses presentation
  through style classes instead of `setStyle(...)`.
- Stylesheet files live directly under `resources/` so the application keeps
  one shared styling surface instead of feature-local CSS islands.
- The desktop icon is authored once as `resources/icons/salt-marcher.svg`;
  build packaging derives the runtime PNG window icon from that SVG instead of
  versioning a second icon source.

## Documentation Map

- `AGENTS.md` for project-wide rules and documentation governance
- `docs/architecture/` for centralized architecture guidance
- `docs/adr/` for single architecture decisions
- `docs/compat/` for deprecated compatibility stubs that point at canonical
  co-located documents
- `src/domain/<feature>/README.md` for feature entry documentation
- `src/view/<component>/UI.md` for component-local UI behavior
- `src/data/<feature>/PERSISTENCE.md` for persistence ownership and rules

- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/documentation.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [ADR 001: Documentation Governance](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/001-documentation-governance.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 004: Shared Runtime Session Store](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/004-shared-runtime-session-store.md:1)
- [ADR 005: MVVM And Assembly Boundary In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/005-view-mvvm-and-assembly-boundary.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
- [ADR 008: Top-Level Repository Taxonomy](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/008-top-level-repository-taxonomy.md:1)
- [ADR 009: Domain-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/009-domain-layer-architecture-model.md:1)
- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/013-domain-layer-ddd-primary-model.md:1)
- [ADR 010: Data-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/010-data-layer-architecture-model.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
- [ADR 012: System-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/012-system-layer-architecture-model.md:1)
