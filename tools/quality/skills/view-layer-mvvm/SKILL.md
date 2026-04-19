---
name: view-layer-mvvm
description: Use before planning, implementing, refactoring, or reviewing anything under `src/view/**`, shell-facing view-model registration, passive panel views, view resources, or adjacent `UI.md`. This skill defines SaltMarcher's cockpit MVVM target with `src/view/models` tab models and `src/view/views` passive panel content.
---

# View Layer MVVM

## Overview

Use this skill to implement SaltMarcher view code according to the canonical
cockpit MVVM architecture. Treat it as binding execution guidance for work
under `src/view/**` and view resources.

Existing legacy view structure is not precedent. Current component folders,
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

1. Assign every touched type one role: shell host, `view/models` model,
   `view/views` passive panel, domain model, or data adapter.
2. For every touched `view/models` type, identify the one shell contribution it
   represents: left-bar tab, state-pane tab, or top-bar dropdown window.
3. For every touched `view/views` type, identify the one shell surface it
   renders into: control panel, main panel, details content, state panel, or
   dropdown window.
4. Check imports against the allowed API surface before writing code.
5. Move ambiguous logic to the role that owns it instead of copying existing
   legacy placement.

When reviewing view-layer changes:

1. Check that shell registration, ApplicationService wiring, panel
   instantiation, and cross-panel presentation policy stay in `view/models`.
2. Check that JavaFX controls, rendering, widget-local state, and technical
   user-event emitters stay in `view/views`.
3. Check that passive views do not import shell, domain, data, or
   ApplicationService types.
4. Check that business behavior stays behind root domain application services.
5. Treat new component-local `View/`, `ViewModel/`, `assembly/`, view `api/`,
   `Model/`, `Controller/`, or `interactor/` buckets as findings.

## Required Placement Rules

### Shell

The shell owns the fixed cockpit frame and public contracts.

- Keep navigation, top-bar dropdown hosting, empty control/main panel hosting,
  details/history hosting, state-pane precedence, activation, and layout
  persistence in shell host code.
- Do not import feature models, feature views, domain services, or data
  adapters into shell host code.
- Do not encode feature-specific behavior in shell contracts.

### `src/view/models`

`view/models` owns the ViewModel role.

- Put one shell-registered tab model, state-tab model, or top-bar dropdown
  window model in each file.
- Put shell registration metadata, shell surface binding, passive panel
  instantiation, panel binding, ApplicationService lookup, and cross-panel
  presentation state there.
- Own enablement, visibility, selected state, labels, validation messages,
  loading state, failure state, retry state, and stale-result state.
- Bind passive view listeners to model state.
- Bind passive view emitters to model actions and domain application-service
  calls.
- Publish details/history content through shell-owned contracts.
- Use JavaFX beans and collections for bindable state when needed.
- Do not import `src.data.*` or concrete `shell.host.*` types.
- Do not push business invariants into models when they belong in domain code.

### `src/view/views`

`view/views` owns the View role.

- Put one passive panel-content fragment in each file.
- Put JavaFX controls, rendering, FXML controllers or loaders, menus, dialogs,
  cells, skins, drawing code, and widget-local state there.
- Expose listeners, bind targets, setters, callbacks, or observable hooks that
  a model can bind to model-owned state.
- Expose emitters for technical user gestures.
- Do not know what the feature is doing. A view may emit "button pressed" or
  "cell selected"; it must not know that the event generates an encounter,
  mutates a dungeon, or calls a specific ApplicationService.
- Do not import `shell.*`, `src.domain.*`, `src.data.*`, or ApplicationService
  types.

## Default Placement Heuristics

- If code declares shell contribution metadata, chooses panel content for a
  tab, coordinates multiple panels, or calls an ApplicationService, it belongs
  in `view/models`.
- If code declares controls, layout, canvas drawing, dialogs, popups, cell
  factories, or widget event handlers, it belongs in `view/views`.
- If code decides what should be shown, enabled, selected, labelled, loaded, or
  reported across panels, it belongs in `view/models`.
- If code owns business meaning or invariants, it belongs in `src/domain/**`
  behind a root application service.
- If code hosts fixed cockpit surfaces or arbitrates state-pane precedence, it
  belongs in `shell`.

## Forbidden Moves

- Do not add new component-local `View/`, `ViewModel/`, `assembly/`, `api/`,
  `Model/`, `Controller/`, or `interactor/` buckets for target view work.
- Do not import shell, domain, data, or ApplicationService types into
  `view/views`.
- Do not import concrete `shell.host.*` types into `view/models`.
- Do not let a passive view decide cross-panel presentation policy.
- Do not let shell host code import feature models or views.
- Do not store the only copy of shared presentation decisions inside widgets,
  callbacks, or view-local fields.
- Do not treat `COCKPIT_DETAILS` as direct feature-owned slot content; publish
  details/history through shell-owned contracts.
- Do not let active-tab state content and registered state tabs both own the
  state pane at the same time.

## View Resource Rules

- FXML is optional implementation detail for a passive panel view, not the
  architectural unit of composition.
- Keep view resources under `resources/view/` when resources are needed.
- Do not use inline FXML scripts.
- FXML controllers are passive view classes and follow the `view/views` rules.
- FXML event methods may emit technical user events, but they must not own
  feature or business decisions.

## Correctness Rule

Correct view code follows the cockpit MVVM target even when nearby legacy code
does not. Legacy layouts are migration debt. They never justify a new placement
decision.

## References

- [AGENTS.md](../../../../AGENTS.md)
- [Model-View-ViewModel Standard](../../../../docs/standards/view-mvvm.md)
