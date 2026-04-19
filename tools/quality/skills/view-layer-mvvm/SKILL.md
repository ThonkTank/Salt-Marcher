---
name: view-layer-mvvm
description: Use before planning, implementing, refactoring, or reviewing anything under `src/view/**`, shell-facing UI contribution registration, ViewModels, passive Views, view resources, or adjacent `UI.md`. This skill operationalizes SaltMarcher's cockpit MVVM target with contribution roots under `src/view/tabs`, `src/view/topbar`, `src/view/state`, reserved `src/view/details`, reusable `src/view/views`, domain-as-Model, and passive shell slot binding.
---

# View Layer MVVM

## Overview

Use this skill to implement SaltMarcher view code according to the canonical
cockpit MVVM architecture. Treat it as binding execution guidance for work
under `src/view/**` and view resources.

Existing legacy view structure is not precedent. Component-local
`*ViewContribution`, `View/`, `ViewModel/`, `assembly/`, view `api/`,
`Model/`, `Controller/`, and `interactor/` buckets are migration debt.

## Canonical Truth

- The architecture source of truth is
  [docs/standards/view-mvvm.md](../../../../docs/standards/view-mvvm.md).
- Project-wide agent-governance rules live in
  [AGENTS.md](../../../../AGENTS.md).
- This skill operationalizes those rules for agent work in the view layer.

## Required Workflow

Before editing a view surface:

1. Assign every touched type one role: shell host, UI contribution, ViewModel,
   passive View, domain Model, or data adapter.
2. For every touched contribution, identify exactly one shell entrypoint:
   left-bar tab, top-bar dropdown window, or global runtime state-panel tab.
3. For every touched ViewModel, identify the contribution or detail entry
   whose presentation state and actions it owns.
4. For every touched View, identify the one shell surface or reusable fragment
   it renders: controls, main, state, details, dropdown, or reusable generic
   view.
5. Check imports against the allowed API surface before writing code.
6. Move ambiguous logic to the role that owns it instead of copying existing
   legacy placement.

When reviewing view-layer changes:

1. Check that shell registration, `ShellRuntimeContext` lookup, service lookup,
   view instantiation, and binding stay in the contribution.
2. Check that presentation state, command availability, failures, loading
   state, and domain application-service calls stay in the ViewModel.
3. Check that JavaFX controls, rendering, widget-local state, and technical
   user-event emitters stay in Views.
4. Check that passive Views do not import shell, domain, data, or
   ApplicationService types.
5. Check that business behavior stays behind root domain application services.
6. Treat new component-local `View/`, `ViewModel/`, `assembly/`, view `api/`,
   `Model/`, `Controller/`, or `interactor/` buckets as findings.

## Required Placement Rules

### Shell

The shell owns the fixed cockpit frame and public contracts.

- Keep navigation, top-bar dropdown hosting, empty control/main panel hosting,
  details/history hosting, state-pane precedence, activation, and layout
  persistence in shell host code.
- Do not import feature contributions, ViewModels, Views, domain services, or
  data adapters into shell host code.
- Do not encode feature-specific behavior in shell contracts.

### Contributions

Contribution roots own shell wiring:

- `src/view/tabs/<entry>/` for one left-bar tab.
- `src/view/topbar/<entry>/` for one top-bar dropdown window.
- `src/view/state/<entry>/` for one global runtime state-panel tab.
Detail entries under `src/view/details/<entry>/` are not shell-discovered
contribution roots; they contain ViewModels and Views published through the
shell-owned details/history API.

Contribution responsibilities:

- Put one `*Contribution` class in each discovered contribution root.
- Implement `shell.api.ShellContribution`.
- Provide shell registration metadata.
- Look up runtime services through `ShellRuntimeContext`.
- Instantiate the owning `*ViewModel` and passive `*View` classes.
- Bind Views to ViewModel state and actions.
- Return `ShellBinding` slot content.
- Do not import concrete `shell.host.*` or `src.data.*`.
- Do not own presentation state, widget layout, or business rules.

### ViewModels

ViewModels own the MVVM ViewModel role.

- Put one `*ViewModel` class next to the owning contribution or detail entry.
- Own presentation state, selected state, enablement, visibility, labels,
  validation messages, loading state, failure state, retry state, and
  stale-result state.
- Translate View emitters into ViewModel actions and domain
  ApplicationService calls.
- Map domain results into bindable View state.
- Use JavaFX beans and collections for bindable state when needed.
- Do not import `shell.*`, concrete Views, `src.data.*`, or concrete
  `shell.host.*` types.
- Do not push business invariants into ViewModels when they belong in domain
  code.

### Views

Views own the MVVM View role.

- Put contribution-owned passive Views next to their contribution or detail
  entry.
- Put reusable generic passive Views and base Views directly under
  `src/view/views/`.
- Let contribution-owned concrete Views extend reusable generic Views when two
  tabs share one cockpit surface, such as the dungeon map canvas or dungeon
  control panel.
- Put JavaFX controls, rendering, FXML controllers or loaders, menus, dialogs,
  cells, skins, drawing code, and widget-local state there.
- Expose bind targets, properties, setters, callbacks, or observable hooks that
  a contribution can bind to ViewModel-owned state.
- Expose emitters for technical user gestures.
- Do not know what the feature is doing. A View may emit "button pressed" or
  "cell selected"; it must not know that the event generates an encounter,
  mutates a dungeon, or calls a specific ApplicationService.
- Do not import `shell.*`, `src.domain.*`, `src.data.*`, or
  ApplicationService types.

## Runtime State Pane Rule

`COCKPIT_STATE` is not a generic tab area.

- A left-bar tab may contribute active-tab state content through its
  `ShellBinding`.
- If the active left-bar tab contributes state content, that content owns the
  state pane.
- If the active left-bar tab does not contribute state content, the shell shows
  global runtime state-panel tabs from `src/view/state/<entry>/`.
- Encounter belongs under `src/view/state`, not under `src/view/tabs`.

## Default Placement Heuristics

- If code declares shell contribution metadata, chooses shell slot content,
  performs runtime service lookup, instantiates Views, or binds View state, it
  belongs in a contribution.
- If code decides what should be shown, enabled, selected, labelled, loaded, or
  reported across a contribution's Views, it belongs in the ViewModel.
- If code declares controls, layout, canvas drawing, dialogs, popups, cell
  factories, or widget event handlers, it belongs in a View. Shared surface
  structure belongs in reusable `src/view/views`; tab-specific controls stay in
  the contribution-owned concrete View.
- If code owns business meaning or invariants, it belongs in `src/domain/**`
  behind a root application service.
- If code hosts fixed cockpit surfaces or arbitrates state-pane precedence, it
  belongs in `shell`.

## Forbidden Moves

- Do not add new component-local `View/`, `ViewModel/`, `assembly/`, `api/`,
  `Model/`, `Controller/`, or `interactor/` buckets for target view work.
- Do not import shell, domain, data, or ApplicationService types into Views.
- Do not import shell APIs or concrete Views into ViewModels.
- Do not import concrete `shell.host.*` types into contributions.
- Do not let a passive View decide cross-panel presentation policy.
- Do not let shell host code import feature contributions, ViewModels, or
  Views.
- Do not store the only copy of shared presentation decisions inside widgets,
  callbacks, or view-local fields.
- Do not treat `COCKPIT_DETAILS` as direct feature-owned slot content; publish
  details/history through shell-owned contracts.
- Do not let active-tab state content and registered runtime state-panel tabs
  both own the state pane at the same time.

## View Resource Rules

- FXML is optional implementation detail for a passive View, not the
  architectural unit of composition.
- Keep view resources under `resources/view/` when resources are needed.
- Do not use inline FXML scripts.
- FXML controllers are passive View classes and follow the View rules.
- FXML event methods may emit technical user events, but they must not own
  feature or business decisions.

## Correctness Rule

Correct view code follows the cockpit MVVM target even when nearby legacy code
does not. Legacy layouts are migration debt. They never justify a new
placement decision.

## References

- [AGENTS.md](../../../../AGENTS.md)
- [Model-View-ViewModel Standard](../../../../docs/standards/view-mvvm.md)
