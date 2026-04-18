Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Binding view-layer architecture model, role boundaries,
public reuse boundary, and enforcement targets for `src/view/**`.

# View MVCI Standard

## Goal

SaltMarcher uses a strict passive-view MVCI model so the view layer has one
authored presentation state, one explicit composition boundary, and one
mechanically enforceable dependency direction.

## Core Principles

- The view layer follows Fowler-style `Passive View`: views render state and
  forward gestures, but do not make business or presentation-policy decisions.
- `Model/` owns the canonical presentation state as plain state, not as
  JavaFX-controlled widget state.
- `assembly/` is the only shell-facing composition boundary inside a component.
- Cross-component view reuse is opt-in and public only through
  `src/view/<component>/api/**`.
- No private MVCI bucket may be imported across component boundaries.

## Component Topology

```text
src/view/
  <component>/
    <PascalComponentName>ViewContribution.java
    assembly/
    api/              optional; the only public view-to-view boundary
    Controller/
    View/
    Model/
    interactor/
```

- The component root is reserved for exactly one `*ViewContribution`.
- `api/` exists only when a component intentionally exports reusable view-layer
  capabilities to other view components.
- Every other Java type in a component belongs to exactly one named bucket.

## Authored Flow

The canonical flow of control and state is:

1. `*ViewContribution -> assembly`
2. `assembly -> Controller + View + Model + interactor`
3. `View -> Controller -> interactor`
4. `interactor -> domain API`
5. `interactor -> Model`
6. `View <- Model`

Additional rules:

- Shell and persistence access enter a component only through the root
  entrypoint or `assembly/`.
- Cross-component composition flows only through foreign `api/` packages.
- The controller never reads authored state from `Model/`.
- The interactor never renders nodes or owns shell composition.

## Role Definitions

### Root Entrypoint

`<Component>ViewContribution.java` owns only shell registration and delegation
into the component assembly.

- Responsibilities:
  - define `registrationSpec()`
  - obtain `ShellRuntimeContext`
  - create or fetch the component assembly
  - return the `ShellScreen`
- Allowed dependencies:
  - `shell.*`
  - own `assembly/`
  - general-purpose JDK types
- Forbidden dependencies:
  - own `Controller/`, `View/`, `Model/`, or `interactor/`
  - `src.domain.*` and `src.data.*`

### `assembly/`

`assembly/` owns slice composition and all shell-facing adaptation.

- Responsibilities:
  - create the component's `Model`, `interactor`, `Controller`, and `View`
  - obtain `ShellRuntimeContext` services, sessions, persistence factories, and
    inspector sinks
  - adapt shell-owned services into component-local collaborators
  - host reusable public facades exported through `api/`
- Allowed dependencies:
  - `shell.*`
  - own `api/`, `Controller/`, `View/`, `Model/`, and `interactor/`
  - foreign `src.view.<component>.api.*`
  - `src.domain.<feature>.*API` and `src.domain.<feature>.api.*`
  - general-purpose JDK types
- Forbidden dependencies:
  - `src.data.*`

### `Controller/`

`Controller/` is the public gesture boundary of a component.

- Responsibilities:
  - expose user-triggered actions as methods
  - translate UI gestures into interactor calls
  - remain thin and policy-free
- Allowed dependencies:
  - own `interactor/`
  - general-purpose JDK types
- Forbidden dependencies:
  - own `Model/`
  - `shell.*`
  - `src.domain.*`
  - `src.data.*`
  - foreign view components
- Contract rule:
  - controller method signatures must not use `Model/` types

### `View/`

`View/` owns every JavaFX scene-graph type and every rendering concern.

- Responsibilities:
  - create nodes, controls, dialogs, popups, menus, and cell factories
  - bind or project authored state from `Model/` into widget state
  - forward user gestures into `Controller/`
  - own local ephemeral widget state such as selection models, popup state, or
    transient filter text that is not canonical presentation state
- Allowed dependencies:
  - `javafx.*`
  - own `Model/`, `Controller/`, and `View/`
  - foreign `src.view.<component>.api.*`
  - general-purpose JDK types
- Forbidden dependencies:
  - `shell.*`
  - own `interactor/`
  - `src.domain.*`
  - `src.data.*`

### `Model/`

`Model/` owns the canonical presentation state.

- Responsibilities:
  - hold plain presentation values, records, enums, and state aggregates
  - define the authored state that the view renders
  - distinguish canonical presentation state from derived widget state
- Allowed dependencies:
  - own `Model/`
  - general-purpose JDK types
- Forbidden dependencies:
  - `javafx.*`
  - `shell.*`
  - `src.domain.*`
  - `src.data.*`
  - own `View/`, `Controller/`, `interactor/`, and `assembly/`
  - foreign view components

### `interactor/`

`interactor/` owns presentation orchestration and all communication with domain
feature APIs.

- Responsibilities:
  - execute user intent coming from the controller
  - call domain feature APIs
  - map domain responses into `Model/`
  - contain presentation policy that is independent of scene-graph types
- Allowed dependencies:
  - own `Model/` and `interactor/`
  - `src.domain.<feature>.*API` and `src.domain.<feature>.api.*`
  - general-purpose JDK types
- Forbidden dependencies:
  - `javafx.*`
  - `shell.*`
  - `src.data.*`
  - own `View/`, `Controller/`, and `assembly/`
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
  - own `Model/`, `View/`, `Controller/`, `interactor/`, or `assembly/` types
  - foreign private bucket types

## Shared Reuse Rule

- Direct imports from another component's `Model/`, `View/`, `Controller/`,
  `interactor/`, or `assembly/` are forbidden.
- A component that wants to be reusable must publish an explicit `api/`
  package.
- A consuming component may depend only on that foreign `api/` package.
- `*shared` naming may still be used as an organizational hint, but the public
  boundary is `api/`, not the component name.

## Forbidden Patterns

- `interactor/` returning `Node`, `Control`, `Scene`, `Stage`, or any other
  scene-graph type
- `interactor/` building dialogs, popups, menus, list cells, or layout nodes
- `Controller/` importing `Model/` types for action parameters or return values
- `Model/` storing `Property`, `ObservableList`, `Binding`, or other
  `javafx.*` types
- `View/` calling domain or data layers directly
- root entrypoints directly creating domain feature APIs or reading
  `ShellRuntimeContext.persistence()` for routine slice wiring
- shell-specific types appearing below the root entrypoint or `assembly/`
- cross-component reuse through copied DTOs instead of one exported public
  `api/`

## Migration Debt Classes

The current codebase already contains migration debt relative to this model.
The debt falls into four named classes:

- interactor-owned scene graph
- controller-to-model coupling
- foreign private bucket reuse
- framework-coupled model state

New code must not introduce additional debt in these classes. Existing debt may
only move toward the target model.

## Verification Notes

- `checkMvci` via `jQAssistant` is the single future owner for mechanical MVCI
  enforcement.
- The current `checkMvci` rule set already covers part of this standard:
  - bucket dependency direction
  - private foreign-component bucket bans
  - root-entrypoint count
  - bucket/package consistency
  - runtime-session and shell-adapter placement
- The following parts of this standard are not yet fully modeled by a named
  mechanical gate and therefore remain review-owned until `checkMvci` expands:
  - root-entrypoint dependency restriction to `shell.*` plus own `assembly/`
  - plain-state ban on `javafx.*` in `Model/`
  - controller ban on `Model/` types
  - public `api/` as the only cross-component reuse boundary
  - public-signature ban on leaking private bucket types through `api/`
  - scene-graph confinement to `View/` and `assembly/`

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
- [ADR 005: Strict MVCI Roles In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/005-strict-view-mvci-and-assembly-bucket.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
