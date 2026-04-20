Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: System-wide architecture summary and entry point into the
architecture documentation set.

# Architecture Overview

## Purpose

SaltMarcher is structured as a passive-shell JavaFX application with feature
slices under `src/`. The shell exposes fixed cockpit surfaces, registration
contracts, and shell-owned runtime services. View-layer contributions register
UI entrypoints and bind passive Views to ViewModels without feature-specific
wiring in bootstrap or concrete shell host classes.

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive cockpit host and shell contracts
src/view/    cockpit contributions, ViewModels, and passive Views
src/domain/  hexagonal application core by context
src/data/    outbound adapters by feature
resources/   static resources and centralized stylesheets
docs/        architecture overview, standards, ADRs, references, and stubs
tools/       build infrastructure, quality platforms, and engineering scripts
```

## System Model

- `bootstrap/` creates the shell and discovers service contributions and UI
  contributions generically.
- `shell/` owns passive cockpit surfaces: top-left controls, primary main
  panel, top-right details/history, bottom-right state pane, top-bar dropdown
  windows, navigation, activation, and shared runtime-session state.
- `src/view/leftbartabs/<entry>/` owns one left-bar tab, its shell
  contribution, Binder, aggregate ViewModel, and optional active-root Views.
- `src/view/statetabs/<entry>/` owns one global state tab, its
  shell contribution, Binder, aggregate ViewModel, and state View. These state tabs
  are shown when the active left-bar tab does not claim `COCKPIT_STATE`.
- `src/view/dropdowns/<entry>/` owns one dropdown-capable UI unit. Its shell
  contribution is optional and exists only when bootstrap should discover it.
- `src/view/slotcontent/<slot>/<entry>/` owns reusable or standalone passive
  JavaFX content and optional slot-local ViewModels for exactly one cockpit
  slot.
- `src/domain/<context>/` owns the hexagonal application core: domain truth,
  invariants, policy decisions, application services, published language,
  outbound ports, and role-explicit domain modules inside one real domain
  context.
- `src/data/<feature>/` owns persistence and external-system adapters that
  implement domain-owned outbound ports.
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

## Domain Context Relationships

- `party`: Roster Truth Context. Owns party roster truth, membership, XP
  progression, rest cadence, and adventuring-day policy.
- `creatures`: Reference Catalog Context. Exports imported creature catalog
  lookup language, detail records, filters, and encounter-candidate reference
  profiles. It does not own encounter balancing or creature lifecycle truth.
- `encounter`: Generation Policy Context. Consumes `party` and `creatures`
  through their application services and published language, then owns runtime
  encounter generation, candidate narrowing, ranking, locks, and composition
  policy.
- `dungeon`: Authored World-Space Context. Owns authored dungeon map/world
  truth, topology, rooms/spaces, connections, identity, and map mutation rules.
  It publishes domain map/world facts through `published/`.

`mapcore` is removed from the domain layer. Reusable map render input is a view
display-model concern, not a domain context.

## Dependency Direction

SaltMarcher uses a system-layer model with repository roots `bootstrap`,
`shell`, `view`, `domain`, and `data`.

Dependencies point inward toward the application core:

- bootstrap depends on shell contracts.
- shell owns generic cockpit hosting and must not import feature code.
- view contributions reach shell public contracts and their own Binder.
- Binders reach shell public contracts, own ViewModels, own Views,
  slotcontent, and domain application-service roots.
- Active-root ViewModels own aggregate presentation state and may call domain
  application services; slotcontent ViewModels own slot-local projections.
- passive Views render ViewModel state and emit user gestures without shell,
  domain, data, or ApplicationService dependencies.
- domain code owns business rules, published language, and domain-owned
  outbound ports.
- data code implements domain-owned outbound ports and externalizes infrastructure
  details.

Below the view layer, the only public client-facing backend boundary is a
feature's `*ApplicationService`. The shell-owned runtime registry remains a
composition facility used to assemble or obtain those application services and
other runtime capabilities; it is not a second public backend layer.

## Registration Model

The application registers feature UI through UI contributions and exported
runtime capabilities through service contributions.

- shell public contracts provide registration metadata, fixed surface binding,
  lifecycle hooks, details/history publication, and runtime context.
- `src/view/leftbartabs/**` contributes left-bar tabs.
- `src/view/statetabs/**` contributes global state tabs.
- `src/view/dropdowns/**` may contribute top-bar dropdown windows when a
  `*Contribution` is present.
- `shell/api/ServiceContribution` registers typed root application services
  into the shared shell service registry, `ServiceRegistry`.
- `shell/api/ShellRuntimeContext` provides shell-owned shared services such as
  runtime-capability lookup, details/history publishing, and per-shell runtime
  sessions.
- Bootstrap discovers UI contributions and data service contributions
  generically. Adding a feature should not require routine shell or bootstrap
  edits.

The view layer target follows SaltMarcher cockpit MVVM: contributions own shell
registration, Binders own runtime wiring and lifecycle, active-root ViewModels
own aggregate presentation state and actions, slotcontent ViewModels own
slot-local projections, and Views own passive JavaFX content. The domain layer
is the MVVM Model behind each feature's root application service. Detailed
rules live only in the dedicated MVVM standard.

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
- `src/view/<area>/<entry>/<topic>.md` for active-root UI behavior
- `src/view/slotcontent/<slot>/<entry>/<topic>.md` for reusable slotcontent
  behavior
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
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)
- [ADR 023: Hexagonal Domain Core](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/023-hexagonal-domain-core.md:1)
