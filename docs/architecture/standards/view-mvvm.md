Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Binding view-layer architecture model, role boundaries,
public reuse boundary, and enforcement targets for `src/view/**`.

# Model-View-ViewModel Standard

## Goal

SaltMarcher uses `Model-View-ViewModel (MVVM)` so the view layer has one
authoritative owner for presentation decisions, one explicit composition
boundary, one public reuse boundary, and one mechanically enforceable
dependency direction.

The architectural goals are:

- `Decoupling`: scene-graph code, shell wiring, and domain orchestration must
  stay in separate roles with inward-only source dependencies.
- `Deduplication`: one `ViewModel` owns presentation interpretation for one
  screen or reusable view root, instead of duplicating UI decisions across
  widgets, helpers, and coordinators.

## Pattern Alignment

- The canonical pattern name is `Model-View-ViewModel (MVVM)`.
- Fowler `Presentation Model` is the conceptual ancestor for pulling
  presentation behavior out of the view. SaltMarcher uses the more widely
  understood `ViewModel` term.
- `Clean Architecture` governs source dependency direction between the view
  layer, the shell, and domain application services.
- Fowler `Passive View` and `Supervising Controller` remain useful reference
  patterns, but they are not the active name of the SaltMarcher target model.

## Core Principles

- `ViewModel/` is the single authoritative owner of presentation state and
  presentation decisions for one component root.
- `View/` owns rendering, widget composition, and simple binding or projection
  from the `ViewModel`.
- `assembly/` is the only shell-facing composition boundary inside a component.
- Cross-component view reuse is opt-in and public only through
  `src/view/<component>/api/**`.
- No private view bucket may be imported across component boundaries.
- New components and architectural refactors target MVVM topology directly.
  Legacy `Model/`, `Controller/`, or `interactor/` buckets are migration debt
  and must not be copied into new work.

## Component Topology

```text
src/view/
  <component>/
    <PascalComponentName>ViewContribution.java
    assembly/
    api/              optional; the only public view-to-view boundary
    View/
    ViewModel/
```

- The component root is reserved for exactly one `*ViewContribution`.
- `api/` exists only when a component intentionally exports reusable
  view-layer capabilities to other view components.
- Every other Java type in a component belongs to exactly one named bucket.

## Dependency Direction

Source dependencies point inward:

1. `*ViewContribution -> assembly`
2. `assembly -> View + ViewModel + api + domain application service`
3. `View -> ViewModel`
4. `ViewModel -> domain API`

Additional rules:

- Shell and backend-service access enter a component through the root
  entrypoint and are consumed in `assembly/`. The current Java
  runtime-capability lookup API is `ShellRuntimeContext.services()`;
  it is a shell-owned composition seam, not a second client-facing backend
  boundary.
- Cross-component composition flows only through foreign `api/` packages.
- `ViewModel/` must not depend on `View/`, `shell.*`, or `src.data.*`.
- `View/` must not depend on `src.domain.*`, `src.data.*`, or `shell.*`.

Runtime control flow may move in both directions, but source dependencies must
still respect these boundaries.

## Runtime Interaction

The normal interaction loop is:

1. `View` receives a user gesture.
2. `View` forwards the action to the `ViewModel`.
3. `ViewModel` executes presentation logic and calls domain application
   services when
   needed.
4. `ViewModel` updates presentation state.
5. `View` reloads or rebinds from the `ViewModel`.

Rules for synchronization:

- The `View` may perform simple binding and projection work.
- The `View` must not invent presentation policy, duplicate domain-to-UI
  interpretation logic, or own the only copy of mutable presentation state.
- Derived presentation facts that matter across multiple widgets belong in the
  `ViewModel`, not in duplicated view helpers.

## Role Definitions

### Root Entrypoint

`<Component>ViewContribution.java` owns only shell registration and delegation
into the component assembly.

- Responsibilities:
  - define `registrationSpec()`
  - accept `ShellRuntimeContext` and delegate it into the owning `assembly/`
  - create or fetch the component assembly
  - return the assembly-prepared `ShellScreen`
- Allowed dependencies:
  - `shell.*`
  - own `assembly/`
  - general-purpose JDK types
- Forbidden dependencies:
  - own `View/`, `ViewModel/`, or `api/` implementations
  - `src.domain.*` and `src.data.*`
- Forbidden behavior:
  - routine runtime-capability lookup or domain-application-service creation
  - direct construction of `View/` or `ViewModel/` objects

### `assembly/`

`assembly/` owns slice composition and all shell-facing adaptation.

- Responsibilities:
  - create the component's `ViewModel` and `View`
  - obtain `ShellRuntimeContext` services, sessions, backend-service
    factories, backend capabilities used to assemble those factories, and
    inspector sinks
  - adapt shell-owned services into component-local collaborators
  - host reusable public facades exported through `api/`
- Allowed dependencies:
  - `shell.*`
  - own `api/`, `View/`, and `ViewModel/`
  - foreign `src.view.<component>.api.*`
  - `src.domain.<feature>.*ApplicationService`, nested boundary types such as
    `*ApplicationService.Factory`, and
    `src.domain.<feature>.api.*`
  - general-purpose JDK types
- Forbidden dependencies:
  - `src.data.*`

### `View/`

`View/` owns every JavaFX scene-graph type and every rendering concern.

- Responsibilities:
  - create nodes, controls, dialogs, popups, menus, and cell factories
  - bind or project state from `ViewModel/` into widget state
  - forward user actions into `ViewModel/`
  - own local ephemeral widget state such as focus, selection models, popup
    visibility, or transient text that is purely local to one widget subtree
- Allowed dependencies:
  - `javafx.*`
  - own `View/` and `ViewModel/`
  - foreign `src.view.<component>.api.*`
  - general-purpose JDK types
- Forbidden dependencies:
  - `shell.*`
  - `src.domain.*`
  - `src.data.*`

### `ViewModel/`

`ViewModel/` owns presentation state, presentation policy, and user-triggered
actions.

- Responsibilities:
  - hold view-consumable presentation values, records, enums, and state
    aggregates
  - expose user-triggered actions and command-style methods
  - map domain responses into presentation state
  - own derived presentation facts such as enablement, visibility, labels, and
    status summaries when those decisions matter beyond one widget
- Allowed dependencies:
  - own `ViewModel/`
  - `src.domain.<feature>.*ApplicationService` and
    `src.domain.<feature>.api.*`
  - general-purpose JDK types
- Forbidden dependencies:
  - `javafx.*`
  - `shell.*`
  - `src.data.*`
  - own `View/` and `assembly/`
  - foreign private view buckets

### `api/`

`api/` is the only public reuse boundary between view components.

- Responsibilities:
  - expose reusable view-layer capabilities intentionally
  - shield consumers from private bucket types
  - define stable public factory, facade, or wrapper types for view reuse
- Allowed dependencies:
  - own private buckets as implementation detail
  - `javafx.*` when a public view API intentionally returns reusable nodes or
    view wrappers
  - general-purpose JDK types
- Forbidden public signatures:
  - own `View/`, `ViewModel/`, or `assembly/` types
  - foreign private bucket types

## Shared Reuse Rule

- Direct imports from another component's `View/`, `ViewModel/`, or `assembly/`
  are forbidden.
- A component that wants to be reusable must publish an explicit `api/`
  package.
- A consuming component may depend only on that foreign `api/` package.
- `*shared` naming may still be used as an organizational hint, but the public
  boundary is `api/`, not the component name.

## Forbidden Patterns

- `ViewModel/` returning `Node`, `Control`, `Scene`, `Stage`, or any other
  scene-graph type
- `ViewModel/` building dialogs, popups, menus, list cells, or layout nodes
- `View/` calling domain or data layers directly
- `View/` owning the only copy of mutable presentation decisions that multiple
  widgets depend on
- presentation-state carriers such as `*ViewModel`, `*ViewData`, `*State`,
  `*Status`, `*Section`, or `*Model` living outside `ViewModel/` or an
  intentional public `api/`
- root entrypoints performing routine shell or backend-service lookup instead
  of delegating into `assembly/`
- shell-specific types appearing below the root entrypoint or `assembly/`
- cross-component reuse through copied DTOs instead of one exported public
  `api/`
- reflective type lookups such as `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, or equivalent lookup-based reach-throughs under
  `src/view/**`
- new view components introducing `Model/`, `Controller/`, or `interactor/`
  buckets

## Migration Debt

The current codebase may still contain legacy buckets and mixed responsibilities
relative to this target model. They are migration debt, not architectural
precedent.

That migration debt may include feature roots that still inline composition or
service lookup. New work must keep those concerns in `assembly/`.

New code must target MVVM directly. Existing code may only move toward the
target model.

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1).
Concrete rule IDs and checker names are recorded in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-coverage.md:1).

- `Enforced`
  - `jQAssistant` on `checkViewArchitecture` owns canonical
    MVVM topology: allowed buckets only, legacy-bucket bans, root-only
    `*ViewContribution` types, exactly one root per component, naming-based
    `*Assembly` / `*ShellAdapter` placement, and cross-component public-boundary
    checks through foreign `api/`
  - `ArchUnit` on `architectureTest` owns view-component cycle freedom
  - `PMD architecture` on `pmdArchitectureMain` owns root-entrypoint contracts:
    naming, `public final`, public no-arg constructor, implemented shell
    interface, required root methods, stateless root shape, allowed
    contribution-spec construction, and no extra public/protected root members
  - `Error Prone` on `compileJava` owns compiler-precise MVVM bans:
    `createScreen(...)` returns backed by own `assembly/` logic; root
    `ShellScreen` construction bans; direct root use of
    `ShellRuntimeContext.inspector()` / `services()` / `session(...)`;
    documented shell API allowlist checks for roots and `assembly/`; restricted
    dependency rules for `assembly/`, `View/`, `ViewModel/`, and `api/`;
    scene-graph placement that allows `assembly/` to expose
    `javafx.scene.Node` only as a shell slot boundary type;
    presentation-state naming and placement bans; reflective reach-through
    bans; and public-signature bans on leaking private view bucket types
- `Review-Only`
  - whether an `api/` package represents intentional reuse rather than
    convenience exposure
  - whether cross-component reuse copied DTOs or wrappers instead of defining
    the smallest intended `api/`
  - the semantic remainder of shell-specific type usage below the root
    entrypoint or `assembly/` when the distinction is about intent rather than
    referenced type shape
  - `ViewModel/` as the single owner of cross-widget presentation decisions
  - deeper semantic checks that distinguish simple binding from duplicated
    presentation policy
  - whether changes to legacy surfaces move toward the MVVM target model
  - runtime-behaviour questions that depend on callback flow rather than
    source dependency shape

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
- [ADR 005: MVVM And Assembly Boundary In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/005-view-mvvm-and-assembly-boundary.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
