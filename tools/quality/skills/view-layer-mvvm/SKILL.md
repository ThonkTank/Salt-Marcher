---
name: view-layer-mvvm
description: Use before planning, implementing, refactoring, or reviewing anything under `src/view/**` or view FXML resources, including `*ViewContribution`, `View/`, `ViewModel/`, `resources/view/**`, and adjacent `UI.md`. This skill defines SaltMarcher's declarative JavaFX MVVM target.
---

# View Layer MVVM

## Overview

Use this skill to implement SaltMarcher view code according to the canonical
declarative JavaFX MVVM architecture. Treat it as binding execution guidance
for work under `src/view/**` and `resources/view/**`.

Existing legacy view structure is not precedent. Current `assembly/`, view
`api/`, `Model/`, `Controller/`, and `interactor/` buckets are migration debt.

## Canonical Truth

- The architecture source of truth is
  [docs/standards/view-mvvm.md](../../../../docs/standards/view-mvvm.md).
- Project-wide agent-governance rules live in
  [AGENTS.md](../../../../AGENTS.md).
- This skill operationalizes those rules for agent work in the view layer.

## Required Workflow

Before editing a view component:

1. Assign every touched type one role: root contribution, `View`, or
   `ViewModel`.
2. For new or substantially refactored view roots, plan FXML under
   `resources/view/<component>/`.
3. Check imports against the allowed Java/JavaFX API surface before writing
   code.
4. Move ambiguous logic to the role that owns it instead of copying existing
   legacy placement.

When reviewing view-layer changes:

1. Check that UI structure and JavaFX control code stay in `View/` or FXML.
2. Check that presentation state and actions stay in `ViewModel/`.
3. Check that business behavior stays behind root domain application services.
4. Treat new `assembly/`, view `api/`, `Model/`, `Controller/`, or
   `interactor/` buckets as findings.

## Required Placement Rules

### Root Entrypoint

`<Component>ViewContribution.java` is the shell-facing composition adapter.

- Put `registrationSpec()` and `createScreen(...)` there.
- Create or obtain the component `ViewModel` there.
- Load the FXML-backed view there or delegate FXML loading to a small own
  `View/` factory.
- Adapt view nodes into `ShellScreen` slots there.
- Do not put business rules, presentation policy, or JavaFX layout
  construction there.

### `View/`

`View/` owns FXML controllers and JavaFX UI behavior.

- Put `@FXML` controllers, UI-only helpers, dialogs, popups, menus, cell
  factories, and control adapters there.
- Bind controls to `ViewModel/` properties and observable collections.
- Forward user gestures into the `ViewModel`.
- Keep widget-local ephemeral state there when it is local to one control
  subtree.
- Do not call domain APIs, data APIs, or shell APIs there.

### `ViewModel/`

`ViewModel/` owns bindable presentation state and actions.

- Put view-consumable properties, observable lists, records, enums, status
  values, selected-item state, and action methods there.
- Own enablement, visibility, labels, validation messages, loading state,
  failure state, retry state, and stale-result state.
- Call injected root domain application services there.
- Use only `javafx.beans.*` and `javafx.collections.*` from JavaFX.
- Do not reference `javafx.scene.*`, `javafx.stage.*`, `javafx.fxml.*`,
  shell types, data-layer types, or own `View/`.

## Default Placement Heuristics

- If code declares controls, layout, dialogs, popups, cell factories, or
  widget event handlers, it belongs in FXML or `View/`.
- If code decides what should be shown, enabled, selected, labelled, loaded, or
  reported to the user, it belongs in `ViewModel/`.
- If code owns business meaning or invariants, it belongs in `src/domain/**`
  behind a root application service.
- If code composes shell slots, loads FXML roots, or creates a view model, it
  belongs in the root `*ViewContribution`.

## Forbidden Moves

- Do not add new `assembly/`, `api/`, `Model/`, `Controller/`, or
  `interactor/` buckets for target view work.
- Do not import `src.domain.*`, `src.data.*`, or `shell.*` into `View/`.
- Do not import JavaFX scene, stage, or fxml APIs into `ViewModel/`.
- Do not let `ViewModel/` return `Node`, `Control`, `Scene`, `Stage`, or other
  scene graph/window types.
- Do not let shell types appear below the root entrypoint.
- Do not import another component's private view packages.
- Do not store the only copy of shared presentation decisions inside widgets,
  callbacks, or controller-local fields.

## FXML Rules

- Prefer FXML for new and substantially refactored view roots.
- Keep FXML under `resources/view/<component>/`.
- Do not use inline FXML scripts.
- `fx:controller` classes are `View/` classes.
- `@FXML` methods may translate events into view-model actions, but they must
  not own business or cross-widget presentation decisions.

## Correctness Rule

Correct view code follows the declarative MVVM target even when nearby legacy
code does not. Legacy layouts are migration debt. They never justify a new
placement decision.

## References

- [AGENTS.md](../../../../AGENTS.md)
- [Model-View-ViewModel Standard](../../../../docs/standards/view-mvvm.md)
