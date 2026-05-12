---
name: view-layer-mvvm
description: Use before planning, implementing, refactoring, or reviewing anything under `src/view/**`, shell-facing contribution registration, Binders, `ContributionModel` or `ContentModel` roles, optional `IntentHandler` roles, passive Views, reusable `slotcontent`, or adjacent `UI.md`. The canonical source of truth is `docs/project/architecture/patterns/view-layer.md`.
---

# View Layer MVVM Compatibility Skill

## Overview

Use this skill to implement SaltMarcher view code according to the canonical
cockpit view-layer architecture.

The skill name stays `view-layer-mvvm` as a compatibility alias. The current
target architecture is defined by:

- [docs/project/architecture/patterns/view-layer.md](../../../../docs/project/architecture/patterns/view-layer.md)
- [AGENTS.md](../../../../AGENTS.md)

This skill operationalizes those documents for agent work in the view layer. It
does not redefine the architecture.

If another project doc restates view-layer rules, treat `view-layer.md` as the
only architectural authority. Neighboring `view-*.md` enforcement docs are
authoritative only for role-local gate inventory and current mechanical drift.

Mandatory default for passive `src/view/**` work:

- identify the touched passive `*View.java` and its co-located same-stem
  `*ContentModel.java` before changing either side
- active roots keep exactly one aggregate `*ContributionModel.java`; every
  passive active-root `*View.java` has exactly one same-stem `*ContentModel.java`
- reusable `slotcontent/**` keeps one closed reusable-unit shape only:
  exactly one `*View.java`, exactly one same-stem `*ContentModel.java`, and a
  same-stem `*ViewInputEvent.java` only when that View is interactive
- apply the same reusable-unit rule under `slotcontent/primitives/**`
- keep input interpretation in the same-root active `*IntentHandler`
- keep component-specific presentation state and component-specific
  presentation logic in the View's own same-stem `*ContentModel`
- keep active-root `*ContributionModel`s focused on root-wide orchestration
  and child-`ContentModel` coordination
- use the direct roundtrip:
  `View -> ViewInputEvent -> same-root IntentHandler -> *ApplicationService -> thin published/*Model readback -> ContributionModel/ContentModel listeners -> View`

## Required Workflow

Before editing a view surface:

1. Assign every touched type one role: shell host, UI contribution, Binder,
   `ContributionModel` or `ContentModel`, optional `IntentHandler`, passive View, domain Model,
   or data adapter.
2. Identify whether the touched code is feature-specific active-root code or
   reusable generic `slotcontent`.
3. For every touched contribution, identify exactly one shell entrypoint:
   left-bar tab, top-bar dropdown window, or global state tab.
4. For every touched Binder, identify the active root whose lifecycle and
   wiring it owns and the reusable `slotcontent` dependencies it intentionally
   assembles.
5. For every touched projection model, identify whether it is the active-root
   aggregate `*ContributionModel` or the same-stem `*ContentModel` for exactly
   one passive View, and which exact surface state it owns.
6. For every touched `IntentHandler`, identify the active root whose view
   events it interprets, including any reused `slotcontent/**` surfaces wired
   into that root, which focused work request it builds per interactive view
   family, and which root `*ApplicationService` entrypoint it calls directly,
   or decide that the root is passive and therefore needs no `IntentHandler`.
7. For every touched passive `*View`, identify its same-stem `*ContentModel`;
   for interactive Views also identify its same-stem `*ViewInputEvent`.
8. Before smell- or size-driven refactors, ask whether the passive `View` is
   compensating for missing projection, hit preparation, geometry derivation,
   or input-relevant state that belongs in a `ContributionModel`,
   `ContentModel`, or upstream `published/*Model` readback path.
9. Move ambiguous logic to the owning role instead of copying nearby legacy
   placement.
10. Only after that ownership check may you use nested/private helper types as
    a local cleanup tactic; do not default to new top-level helper files under
    `src/view/**`.
11. Treat any new top-level file outside the active-root or reusable role
    shapes as a target-architecture finding unless the user explicitly scopes
    the work to current-state compatibility only.

When reviewing view-layer changes:

1. Check that shell registration stays in the contribution.
2. Check that service lookup, role instantiation, binding, and shell-facing
   lifecycle stay in the Binder.
3. Check that bindable projection state and projection logic stay in the
   owning `ContributionModel` or `ContentModel`.
4. Check that input interpretation stays in the same-root `IntentHandler`
   with one focused entrypoint per interactive `View`, and that domain work
   leaves there through a direct root `*ApplicationService` call rather than
   through a reusable local handler or a second write protocol.
5. Check that feature-specific one-off components are colocated in their active
   root and that `slotcontent/**` is used only for genuinely reusable generic
   components.
6. Check that passive Views bind only to their own same-stem `ContentModel`,
   react through bindings/listeners, and emit full same-stem `ViewInputEvent`
   snapshots instead of issuing imperative commands into a model.
7. Check that passive Views do not import shell, domain, data, or
   ApplicationService types.
8. Treat new component-local `View/`, `ViewModel/`, `assembly/`, view `api/`,
   `Model/`, `Controller/`, or `interactor/` buckets as findings.
9. Treat PMD-driven helper splits as findings when the real missing owner is
   the owning `ContributionModel`, `ContentModel`, or the upstream readback
   path.
10. Treat any top-level file under reusable `slotcontent/**` outside the
    closed shape `*View`, `*ViewInputEvent`, and `*ContentModel` as a
    finding.

## Placement Heuristics

- If code declares shell contribution metadata, it belongs in a contribution.
- If code chooses shell slot content, performs runtime service lookup,
  instantiates roles, or installs initial listeners/callbacks, it belongs in a Binder.
- If code decides what should be shown, enabled, selected, labelled, loaded,
  or reported across a surface, it belongs in the owning
  `ContributionModel` or `ContentModel`.
- If that decision is component-specific presentation logic, it belongs in the
  paired View's own `ContentModel`, not in the active-root `ContributionModel`.
- If code reacts to thin same-context `published/*Model` readback to refresh
  projection state, that reaction belongs in the owning `ContributionModel`
  or `ContentModel`, not as a Binder-owned projection-forwarding workflow.
- If code interprets raw gestures into local semantic intent or local UI-state
  mutation for a reusable component, it belongs in the same-root
  `IntentHandler`, not in reusable `slotcontent/**`.
- If code declares JavaFX controls, layout, canvas drawing, dialogs, popups,
  cell factories, or widget event handlers, it belongs in a View.
- If code prepares render-ready, hit-ready, label, geometry, selection, or
  other pre-render/pre-hit state, it belongs in the owning `ContributionModel`,
  same-stem `ContentModel`, or upstream read-side projection rather than in
  new standalone top-level files.
- If code is feature-specific and not reusable, colocate it in the owning
  `leftbartabs`, `dropdowns`, or `statetabs` package.
- If code is reusable generic view-layer content, place it under
  `src/view/slotcontent/**`.
- If code owns business meaning or invariants, it belongs in `src/domain/**`
  behind a root application service.

## Review Flags

- feature-specific one-off code under `src/view/slotcontent/**`
- new canonical ownership outside `src/view/slotcontent/primitives/**`
- Binder logic that turns into long-lived feature orchestration instead of
  one-time wiring plus callback seams
- projection-model code that reaches beyond read-side `published/**` intake
- `IntentHandler` code that reaches beyond same-root `ContributionModel`,
  child `ContentModel`, same-root or reused `ViewInputEvent`, matching root
  `*ApplicationService` entrypoints, and same-surface support
- Views that command model behavior directly instead of reacting to observable
  state
- reusable `slotcontent/**` units that grow any top-level role outside the
  closed `View + ViewInputEvent + ContentModel` shape

## Correctness Rule

Correct view code follows the canonical cockpit view-layer target even when
nearby legacy code does not. Legacy layouts and lingering `*ViewModel` class
names are migration debt. They never justify a new placement decision.
