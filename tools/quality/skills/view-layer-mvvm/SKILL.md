---
name: view-layer-mvvm
description: Use before planning, implementing, refactoring, or reviewing anything under `src/view/**`, shell-facing contribution registration, Binders, `PresentationModel` roles, optional `IntentHandler` roles, passive Views, reusable `slotcontent`, or adjacent `UI.md`. The canonical source of truth is `docs/project/architecture/view-layer.md`.
---

# View Layer MVVM Compatibility Skill

## Overview

Use this skill to implement SaltMarcher view code according to the canonical
cockpit view-layer architecture.

The skill name stays `view-layer-mvvm` as a compatibility alias. The current
target architecture is defined by:

- [docs/project/architecture/view-layer.md](../../../../docs/project/architecture/view-layer.md)
- [docs/project/architecture/view-layer-role-contracts.md](../../../../docs/project/architecture/view-layer-role-contracts.md)
- [AGENTS.md](../../../../AGENTS.md)

This skill operationalizes those documents for agent work in the view layer. It
does not redefine the architecture.

## Required Workflow

Before editing a view surface:

1. Assign every touched type one role: shell host, UI contribution, Binder,
   `PresentationModel`, optional `IntentHandler`, passive View, domain Model,
   or data adapter.
2. Identify whether the touched code is feature-specific active-root code or
   reusable generic `slotcontent`.
3. For every touched contribution, identify exactly one shell entrypoint:
   left-bar tab, top-bar dropdown window, or global state tab.
4. For every touched Binder, identify the active root whose lifecycle and
   wiring it owns and the reusable `slotcontent` dependencies it intentionally
   assembles.
5. For every touched `PresentationModel`, identify the active root or reusable
   `slotcontent` unit whose projection state it owns.
6. For every touched `IntentHandler`, identify the interactive scope whose
   input interpretation it owns, or decide that the surface is passive and
   therefore needs no `IntentHandler`.
7. For map surfaces, identify the single reusable canvas-facing
   `PresentationModel` that owns the readback-to-render projection path.
8. Move ambiguous logic to the owning role instead of copying nearby legacy
   placement.

When reviewing view-layer changes:

1. Check that shell registration stays in the contribution.
2. Check that service lookup, role instantiation, binding, and shell-facing
   lifecycle stay in the Binder.
3. Check that bindable projection state and projection logic stay in the
   `PresentationModel`.
4. Check that component-local input interpretation stays in the optional
   `IntentHandler`.
5. Check that feature-specific one-off components are colocated in their active
   root and that `slotcontent/**` is used only for genuinely reusable generic
   components.
6. Check that passive Views react through bindings/listeners and emit technical
   user events instead of issuing imperative commands into a
   `PresentationModel`.
7. Check that passive Views do not import shell, domain, data, or
   ApplicationService types.
8. Treat new component-local `View/`, `ViewModel/`, `assembly/`, view `api/`,
   `Model/`, `Controller/`, or `interactor/` buckets as findings.

## Placement Heuristics

- If code declares shell contribution metadata, it belongs in a contribution.
- If code chooses shell slot content, performs runtime service lookup,
  instantiates roles, or wires listeners/callbacks, it belongs in a Binder.
- If code decides what should be shown, enabled, selected, labelled, loaded,
  or reported across a surface, it belongs in the `PresentationModel`.
- If code interprets raw gestures into local semantic intent or local UI-state
  mutation, it belongs in the optional `IntentHandler`.
- If code declares JavaFX controls, layout, canvas drawing, dialogs, popups,
  cell factories, or widget event handlers, it belongs in a View.
- If code is feature-specific and not reusable, colocate it in the owning
  `leftbartabs`, `dropdowns`, or `statetabs` package.
- If code is reusable generic view-layer content, place it under
  `src/view/slotcontent/**`.
- If code owns business meaning or invariants, it belongs in `src/domain/**`
  behind a root application service.

## Review Flags

- feature-specific one-off code under `src/view/slotcontent/**`
- new canonical ownership under `src/view/primitives/**`
- Binder logic that turns into long-lived feature orchestration instead of
  one-time wiring plus callback seams
- `PresentationModel` code that reaches beyond read-side `published/**`
  intake
- `IntentHandler` code that knows shell APIs, domain carriers, or
  ApplicationServices
- Views that command `PresentationModel` behavior directly instead of reacting
  to observable state

## Correctness Rule

Correct view code follows the canonical cockpit view-layer target even when
nearby legacy code does not. Legacy layouts and lingering `*ViewModel` class
names are migration debt. They never justify a new placement decision.
