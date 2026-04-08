# Dungeon Shared Values

## Purpose

`model` owns the remaining dungeon-wide immutable interaction vocabulary that is shared by shell and runtime code when no more specific owner applies.

## Canonical Types and APIs

- `interaction/DungeonSelectionRef` — canonical dungeon selection vocabulary.
- `interaction/DungeonHitKind` — shared hit-kind vocabulary for dungeon interaction flows.
- `interaction/InteractiveLabelHandle` — shared label-handle value used by dungeon interaction surfaces.

## Where New Code Goes

- Put new immutable dungeon-wide interaction value types here only when no more specific owner should own them.
- Keep owner-specific behavior, workflow state, geometry policy, structure truth, and map state in the documented owners above this directory.

## Forbidden Drift

- Do not turn this directory into a second workflow, map, structure, or repository owner.
- Do not move canonical selection or interaction semantics into ad-hoc shell-local enums or helper records.
