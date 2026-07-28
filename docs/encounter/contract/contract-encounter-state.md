# Encounter State Contract

Status: Active target contract with partial Godot runtime command coverage
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose

This contract defines the public runtime workflow surface used by the encounter
state tab.

## Read Surface

- `EncounterApi` publishes immutable, revisioned encounter workflow state for
  the builder, initiative, combat, and resolution panes plus one status line
- consumers may read the current state and observe later revisions without
  depending on an implementation-owned model handle

## Write Surface

- `ApplyEncounterStateCommand` submits workflow actions such as generate, save
  current plan, open saved plan, roster edits, initiative confirmation, combat
  mutations, XP award, and refresh through `EncounterApi`

Current Godot production commands cover saved-plan open, initiative open/edit/
roll/confirm, individual enemy HP mutation, combat-initiative edit, turn
advance, combat end, one atomic XP award, and return to the preserved builder
roster. Generate, save-current-plan from the runtime workspace, roster edits,
reinforcements, and Scene context synchronization remain target commands.

## Boundary Rules

- the contract is view-facing workflow language, not a transport mirror of
  `EncounterSession`
- readback and commands share the typed Encounter API while remaining separate
  operations
- builder filters live in the separate builder-input contract
- planner-facing saved-plan list and plan-budget reads stay separate from this
  state-tab workflow contract
- commands mutate the encounter runtime session only; they do not expose data
  storage rows or foreign feature internals

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter UI](../requirements/requirements-encounter-state-tab.md) (line 1)
