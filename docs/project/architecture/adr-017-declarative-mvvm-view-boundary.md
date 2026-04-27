# ADR 017: Declarative MVVM View Boundary

- Status: Superseded by [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-020-view-contributions-and-viewmodels.md:1)
- Date: 2026-04-19

## Supersession Note

This ADR is a historical record of SaltMarcher's intermediate component-local
MVVM model. The current target architecture is the cockpit contribution view
layer defined by ADR 020 and the MVVM standard.

## Context

SaltMarcher's previous MVVM standard adopted the right high-level pattern but
kept too much project-local infrastructure in the target view model. It treated
`assembly/` and view `api/` as first-class target buckets, allowed
programmatic JavaFX view construction as normal target code, and made the view
standard harder to learn than the established MVVM model it intended to use.

The project wants the cleaner WPF/Silverlight-style interpretation of MVVM:
the view is declarative markup, the view model is bindable presentation state
and actions, and the model is the application/domain layer. In JavaFX, FXML,
`FXMLLoader`, controllers, JavaFX properties, and binding provide the matching
technical vocabulary.

The existing domain layer already has one root `*ApplicationService` per
feature. That shape is the natural MVVM Model boundary for presentation code.

## Decision

SaltMarcher adopts declarative JavaFX MVVM as the target view architecture.

- `View/` owns FXML controllers, JavaFX binding setup, UI-only event
  extraction, and widget-local state.
- FXML under `resources/view/<component>/` owns view tree structure and static
  layout for new and substantially refactored views.
- `ViewModel/` owns bindable presentation state, presentation policy, and
  user-triggered actions. It may use JavaFX property and collection APIs for
  binding, but it must not use scene graph, stage, or FXML APIs.
- The MVVM `Model` role is `src/domain/**`, exposed to presentation code only
  through each feature's root `*ApplicationService` and `api/` carrier types.
- `*ViewContribution` is the single shell-facing composition adapter for a
  view component. It hosts registration, FXML loading, view-model creation, and
  shell slot adaptation.
- `assembly/`, view `api/`, and legacy view `Model/`, `Controller/`, and
  `interactor/` buckets are not part of the target topology.

This decision supersedes ADR 005 and ADR 007 as target architecture. Those ADRs
remain historical records of the intermediate model.

## Consequences

- Existing programmatic JavaFX views, `assembly/` packages, view `api/`
  packages, and legacy buckets become migration debt.
- The standards can move first. Current source code and current mechanical
  checks may temporarily enforce the older topology until explicit migration
  work updates them.
- The domain standard must state that `api/` is carrier-only and that the
  callable public backend boundary is the root application service.
- The shell standard keeps the fixed cockpit/workbench surfaces, but it no
  longer treats `assembly/` as the target feature composition boundary.
- Future enforcement should be API-based: allow JavaFX scene/fxml APIs only in
  view surfaces, allow JavaFX beans/collections in view models, and keep shell
  and data APIs out of both view controllers and view models.

## Alternatives Considered

### Keep the previous `assembly/` and view `api/` target

Rejected because it made the standard harder than necessary and elevated
composition plumbing into the view architecture model.

### Make FXML optional forever

Rejected because programmatic view construction keeps UI structure hidden in
Java code and weakens the designer/developer separation MVVM is meant to
support.

### Change standards, checks, and source code in one large migration

Rejected for this decision because the current codebase still uses the older
topology. The target architecture can be recorded first, then code and checks
can migrate in deliberate passes.

## Related Documents

- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-mvvm.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-workbench.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-020-view-contributions-and-viewmodels.md:1)
- [ADR 005: MVVM And Assembly Boundary In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-005-view-mvvm-and-assembly-boundary.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-007-shared-view-api-boundary.md:1)
