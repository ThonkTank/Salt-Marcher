# ADR 019: Shell Cockpit MVVM Contribution View Layer

- Status: Superseded by [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
- Date: 2026-04-19

This ADR is a historical record of SaltMarcher's cockpit-oriented MVVM step.
ADR 020 keeps the fixed cockpit surface model but splits shell/workbench
adaptation into `*Contribution` classes and presentation state/actions into
`*ViewModel` classes.

## Context

ADR 017 moved SaltMarcher toward a cleaner MVVM model, but it still used a
generic component-local topology: `*ViewContribution`, `View/`, `ViewModel/`,
and optional FXML resources per component. That model was clearer than the
older assembly boundary, but it still did not match SaltMarcher's actual
workbench shape.

SaltMarcher has a fixed cockpit:

- an empty control panel in the top-left surface
- an empty main panel in the primary work surface
- a details pane with shell-owned history
- a state pane that can show active-tab content or registered state tabs
- top-bar dropdown windows

The target view architecture should make those fixed surfaces explicit. It
should also make views more passive: a view file should be one panel fragment.

## Decision

SaltMarcher adopts the shell cockpit contribution view layer as the target view
architecture.

- The shell owns fixed cockpit surfaces and the public contracts by which
  contributions attach content to them.
- `src/view/leftbartabs/<entry>/` owns one left-bar tab contribution, its ViewModel,
  and its contribution-owned passive Views.
- `src/view/topbar/<entry>/` owns one top-bar dropdown-window contribution, its
  ViewModel, and its dropdown View.
- `src/view/statetabs/<entry>/` owns one global state tab
  contribution, its ViewModel, and its state View.
- `src/view/details/<entry>/` owns detail-entry ViewModels and Views published
  through the shell-owned details/history API. Detail entries are not
  bootstrap-discovered contributions.
- `src/view/views/` owns reusable generic passive Views only.
- Contributions instantiate and bind passive Views, wire view emitters to
  ViewModel actions, perform shell runtime lookup, and return shell slot
  bindings.
- ViewModels own presentation state, call relevant domain
  `*ApplicationService` roots, and map domain results into presentation state.
- Passive panel views do not know feature meaning. They expose listeners or
  bind targets for model state and emitters for technical user gestures.
- The MVVM `Model` role remains `src/domain/**`, exposed to presentation code
  through root application services and domain `api/` carrier types.
- The details pane remains shell-owned and is populated through public
  details/history contracts.
- The state pane uses explicit precedence: active left-bar tab content wins
  while present; otherwise shell-registered global state tabs are
  shown. Encounter is such a state tab, not a left-bar tab.

This decision supersedes ADR 017 as the target view architecture. ADR 017 and
ADR 018 remain historical records of the intermediate component-local model and
shared-component exception.

## Consequences

- Existing `*ViewContribution`, model-shaped shell adapter contracts,
  component-local view folders, shared view `api/` packages, and FXML-root
  composition language are migration debt where they differ from this model.
- The shell standard must define cockpit-surface ownership and state-pane
  precedence.
- The repository structure standard must define the contribution-root view
  topology.
- The discovery standard must move from component-root discovery toward
  `*Contribution` discovery under `src/view/leftbartabs`, `src/view/topbar`, and
  `src/view/statetabs`.
- Architecture checks can lag the standards during migration, but enforcement
  documentation must state the mismatch rather than presenting old checks as
  target truth.
- Source migration should be direct and complete for touched areas; new target
  code should not copy the old component-local structure.

## Alternatives Considered

### Keep ADR 017 as the target

Rejected because it still treats a generic component as the organizing unit.
SaltMarcher needs the fixed cockpit surfaces and tab ownership model to be the
first-class architecture vocabulary.

### Treat `src/view/views` as one view per feature

Rejected because SaltMarcher's shell surfaces are panel-level. A view file is
one panel-content fragment, such as a dungeon render canvas for the main panel
or a dungeon control panel for the control slot. Feature-owned views stay next
to their contribution; `src/view/views` is only for reusable generic Views.

### Let passive views call application services

Rejected because that would collapse passive view behavior into feature
behavior and make the same panel impossible to reason about outside its current
domain use.

### Keep shared view component `api/` packages as the main reuse model

Rejected as target architecture because broad component APIs recreate the
component-local shape. Reuse may be introduced later through narrow contracts,
but the target view unit remains a passive panel fragment.

## Related Documents

- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [ADR 017: Declarative MVVM View Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/017-declarative-mvvm-view-boundary.md:1)
- [ADR 018: Shared View Component Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/018-shared-view-component-boundary.md:1)
