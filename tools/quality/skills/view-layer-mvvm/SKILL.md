---
name: view-layer-mvvm
description: Use before planning, implementing, refactoring, or reviewing anything under `src/view/**`, including `*ViewContribution`, `assembly/`, `View/`, `ViewModel/`, `api/`, and adjacent `UI.md`. This skill defines the mandatory SaltMarcher view-layer execution rules for all agents working in that layer.
---

# View Layer MVVM

## Overview

Use this skill to implement SaltMarcher view code according to the canonical
MVVM architecture. Treat it as binding execution guidance for work under
`src/view/**`.

This skill does not preserve legacy view structure. It defines what correct
view implementation must look like now.

## Use This Skill For

Use this skill before changing or reviewing:

- any file under `src/view/**`
- any `*ViewContribution.java`
- any `assembly/`, `View/`, `ViewModel/`, or `api/` package in the view layer
- any `UI.md` that defines or reviews a view component

Do not use legacy package shape as precedent. If the code conflicts with this
skill or the canonical architecture standard, the code is debt.

## Canonical Truth

- The architecture source of truth is
  [docs/architecture/standards/view-mvvm.md](../../../../docs/architecture/standards/view-mvvm.md).
- Project-wide agent-governance rules live in
  [AGENTS.md](../../../../AGENTS.md).
- This skill operationalizes those rules for agent work in the view layer.
- Existing code is not allowed to redefine the model.

## Required Workflow

Before editing a view component:

1. Identify every touched type and assign it one target role: root entrypoint,
   `assembly`, `View`, `ViewModel`, or `api`.
2. Check the planned source dependencies against the MVVM standard before
   writing code.
3. Move ambiguous logic toward the single role that owns it instead of splitting
   it across multiple buckets.
4. Reject any solution whose only justification is "the current code already
   does it there."

When reviewing view-layer changes:

1. Check that each type has one role only.
2. Check that presentation decisions are owned by one `ViewModel`.
3. Check that cross-component reuse goes only through public `api/`.
4. Treat legacy package names or mixed responsibilities as findings, not
   exceptions.

## Required Placement Rules

### Root Entrypoint

`<Component>ViewContribution.java` is shell registration only.

- Put `registrationSpec()` and shell registration there.
- Delegate routine construction into `assembly/`.
- Do not put domain wiring, scene-graph construction, or presentation logic
  there.

### `assembly/`

`assembly/` owns composition and shell/runtime adaptation.

- Create the component `View` and `ViewModel` there.
- Obtain shell/runtime services there.
- Adapt external collaborators into component-local construction there.
- Keep shell-facing code there instead of leaking it into lower buckets.

### `View/`

`View/` owns JavaFX scene graph and widget behavior.

- Put nodes, controls, dialogs, popups, cell factories, bindings, and widget
  composition there.
- Forward user gestures into the `ViewModel`.
- Keep widget-local ephemeral UI state there when it is local to one subtree.
- Do not call domain APIs or encode presentation policy there.

### `ViewModel/`

`ViewModel/` owns presentation state and presentation decisions.

- Put view-consumable state, derived display facts, actions, and domain-response
  shaping there.
- Call injected domain feature APIs there.
- Make one `ViewModel` the single owner of cross-widget presentation decisions
  for one screen or reusable view root.
- Do not reference JavaFX, shell types, data-layer types, or `View/` there.

### `api/`

`api/` is the only public view-to-view reuse boundary.

- Export reusable view-layer factories, wrappers, or facades there when reuse is
  intentional.
- Keep consumers dependent on `api/` only.
- Do not leak private implementation bucket types through public signatures.

## Default Placement Heuristics

- If code creates, configures, or mutates JavaFX nodes, it belongs in `View/`.
- If code owns presentation state, command handling, enablement, visibility,
  labels, or domain-to-UI interpretation, it belongs in `ViewModel/`.
- If code wires shell/runtime/domain collaborators together, it belongs in
  `assembly/`.
- If code is an intentional cross-component surface, it belongs in `api/`.
- If code is shell registration only, it belongs in the root
  `*ViewContribution`.

## Forbidden Moves

- Do not add new `Model/`, `Controller/`, or `interactor/` buckets for new
  view-layer work.
- Do not import `src.domain.*` or `src.data.*` into `View/`.
- Do not import `javafx.*`, `shell.*`, `src.data.*`, or own `View/` into
  `ViewModel/`.
- Do not let shell types appear below the root entrypoint or `assembly/`.
- Do not import another component's private `View/`, `ViewModel/`, or
  `assembly/` buckets.
- Do not duplicate cross-component DTOs or wrappers when a public `api/`
  boundary should exist.
- Do not store the only copy of shared presentation decisions inside widgets,
  callbacks, or local helper classes in `View/`.

## Correctness Rule

Correct view code follows the target MVVM model even when nearby legacy code
does not. Legacy layouts are migration debt. They never justify a new placement
decision.

## When In Doubt

- Resolve ambiguity toward the smallest role that cleanly owns the concern.
- Prefer moving presentation interpretation into `ViewModel/` over duplicating
  it in multiple `View/` classes.
- Prefer moving shell/runtime adaptation into `assembly/` over leaking it into
  the component interior.
- Prefer introducing a deliberate `api/` over cross-component reach-through.

## References

- [AGENTS.md](../../../../AGENTS.md)
- [Model-View-ViewModel Standard](../../../../docs/architecture/standards/view-mvvm.md)
