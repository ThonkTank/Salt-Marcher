Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: System-wide architecture summary and entry point into the
architecture documentation set.

# Architecture Overview

## Purpose

SaltMarcher is structured as a passive-shell JavaFX application with feature
slices under `src/`. The shell exposes fixed cockpit surfaces, registration
contracts, and shell-owned runtime services. View models register tabs and bind
passive panel views into those shell surfaces instead of using feature-specific
wiring in bootstrap or concrete shell host classes.

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive cockpit host and shell contracts
src/view/    tab models plus passive panel views
src/domain/  domain logic by feature
src/data/    infrastructure adapters by feature
resources/   static resources and centralized stylesheets
docs/        architecture overview, standards, ADRs, references, and stubs
tools/       build infrastructure, quality platforms, and engineering scripts
```

## System Model

- `bootstrap/` creates the shell and discovers service contributions and view
  model contributions generically.
- `shell/` owns passive cockpit surfaces: top-left controls, primary main
  panel, top-right details/history, bottom-right state pane, top-bar dropdown
  windows, navigation, activation, and shared runtime-session state.
- `src/view/models/` owns shell-facing tab and window ViewModels. A model file
  defines one tab, state tab, or top-bar dropdown window; it registers with the
  shell, instantiates passive panel views, binds those views to presentation
  state, and calls domain application services.
- `src/view/views/` owns passive JavaFX panel content. A view file defines one
  panel fragment for one shell surface; it exposes listeners for model state
  and emitters for user gestures.
- `src/domain/<feature>/` owns business meaning, invariants, policy decisions,
  aggregates, application services, exported boundary types, and named domain
  modules inside one bounded context.
- `src/data/<feature>/` owns persistence and external-system adapters.
- `src/data/persistencecore/` holds shared SQLite infrastructure reused by
  multiple persistence features without becoming an application-service
  boundary of its own.
- `tools/gradle/` owns included Gradle builds such as the convention plugin and
  build harness.
- `tools/quality/` owns quality-platform configuration, custom rule projects,
  engineering helper scripts, and repo-owned Codex skills.

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
  Consumes `party` and `creatures` through their application services and
  public API carriers, then owns runtime encounter balancing, candidate
  ranking, locks, and generated-encounter policy.
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
- shell owns generic cockpit hosting and must not import feature code.
- view models reach backend content through shell public contracts and domain
  application services.
- passive views render model state and emit user events without shell, domain,
  data, or ApplicationService dependencies.
- domain code owns business rules and domain-owned ports.
- data code implements domain-owned contracts and externalizes infrastructure
  details.

Below the view layer, the only public client-facing backend boundary is a
feature's `*ApplicationService`. The shell-owned runtime registry remains a
composition seam used to assemble or obtain those application services and
other runtime capabilities; it is not a second public backend layer.

## Registration Model

The application registers feature UI through view models and exported runtime
capabilities through service contributions.

- shell public contracts provide registration metadata, fixed surface binding,
  lifecycle hooks, details/history publication, and runtime context.
- `src/view/models/**` contributes left-bar tabs, state-pane tabs, and top-bar
  dropdown windows.
- `shell/api/ServiceContribution` registers typed backend capabilities and
  application-service factories into the shared shell service registry,
  `ServiceRegistry`.
- `shell/api/ShellRuntimeContext` provides shell-owned shared services such as
  runtime-capability lookup, details/history publishing, and per-shell runtime
  sessions.
- Bootstrap discovers view models and data service contributions generically.
  Adding a feature should not require routine shell or bootstrap edits.

The view layer target follows SaltMarcher cockpit MVVM: `view/models` owns
tab/window ViewModels and shell binding; `view/views` owns passive panel
fragments; the domain layer is the MVVM Model behind each feature's root
application service. Detailed rules live only in the dedicated MVVM standard.

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
- `src/view/models/<topic>.md` or `src/view/views/<topic>.md` for target UI
  behavior; legacy `src/view/<component>/UI.md` files remain migration state
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
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
- [ADR 012: System-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/012-system-layer-architecture-model.md:1)
- [ADR 016: Architecture Enforcement Operating Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/016-architecture-enforcement-operating-model.md:1)
- [ADR 019: Shell Cockpit Tab Model View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
