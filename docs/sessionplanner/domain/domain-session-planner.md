Status: Active Target
Owner: Session Planner Feature
Last Reviewed: 2026-07-18
Source of Truth: Session Planner language, authored truth, and invariants.

# Session Planner Domain Model

## Context Role And Ownership

Context Name: `SessionPlanner`

Context Role: Authored Session Preparation Context

Session Planner owns the editable preparation record for one session. Party,
Encounter, Creatures, World Planner, and Session Generation retain their own
truth. Session Planner records stable references to foreign truth without
copying that truth into its model.

## Published Language

The feature publishes:

- `SessionPlanId`, `SessionSceneId`, and optimistic `SessionRevision`
- session catalog summaries and authored-session commands
- `PrepareSessionCommand` and `PreparationStatus`
- one immutable, revisioned `SessionPlannerWorkspaceSnapshot`
- one revisioned prepared-scene catalog for Scene consumers

SQL rows, repositories, JavaFX controls, and foreign internal models are not
part of the published language.

## Write Model

`SessionPlan` is the sole Session Planner write model and aggregate root. It
owns:

- stable identity, display name, and revision
- session-local participant references
- exact encounter-day fraction
- ordered scenes with title, notes, and optional World Planner location ID
- optional Encounter plan ID and planner-owned allocation per scene
- selected scene identity
- rests between scenes
- manual loot notes
- ordered generated reward references consisting of scene ID, generation-run
  ID, treasure ID, and a last-known display fallback

It does not embed party details, Encounter rosters, creature details, World
Planner records, generated item lines, packing rows, audits, or engine metadata.
Preparation work that has not replaced the aggregate is transient derived
state, never a second write model or authored truth.

## Mutation Language And Invariants

Mutation language covers:

- create, open, rename, or delete a session
- add or remove a session participant reference
- add, edit, remove, or reorder a scene
- attach or detach one saved Encounter plan
- change one linked-scene allocation
- set or clear one rest in a scene gap
- add, update, or remove one authored manual loot note within its owning scene
- select one scene
- replace prepared content as one complete authored mutation

Core invariants:

- the current pointer names one existing persisted session
- a session revision changes for every authored mutation
- participant references are unique within a session
- scene identities and order are unique within a session
- rests exist only between adjacent scenes
- each scene references at most one Encounter plan and one World Planner
  location
- generated reward references name an existing session scene and one positive
  treasure identity in one non-blank generation run
- encounter-channel rewards reference their generated Encounter scene; quest
  and environment rewards reference encounter-free scenes
- manual loot notes never masquerade as generated reward detail
- attaching, replacing, or detaching a saved Encounter plan preserves every
  generated reward reference; deleting a scene alone prunes the manual notes and
  generated reward references owned by that scene
- a manual-note identity is session-local and every note mutation identifies
  both its owning scene and the exact Session revision it was authored from
- every authored mutation, including catalog rename and delete, carries the
  exact Session identity and revision visible at intent time; Current is a read
  and navigation pointer, never an implicit write target
- incomplete preparation never mutates `SessionPlan`
- prepared-content replacement applies to the exact session identity and
  revision it read; concurrent authored edits reject the replacement
- removing a scene removes its planner-owned reward references without deleting
  foreign generated runs or saved Encounter plans

## Derived State

Session Planner derives, without creating another write model:

- participant summaries and planning readiness
- budget, planned XP, remaining or exceeded XP, and rest guidance
- ordered scene summaries and selected-scene detail
- linked and attachable Encounter summaries
- hydrated generated rewards and manual loot-note presentation
- preparation lifecycle, stage, warnings, and retry availability

All presentation sections for one published view describe the same source
`SessionRevision`.

## Consistency Boundary

One `SessionPlan` mutation is the Session Planner consistency boundary. Foreign
generated runs and saved Encounter plans remain immutable truth in their owning
contexts even when a planner reference is absent or later removed. Session
Planner never compensates by deleting that foreign truth.

## References

- [Requirements](../requirements/requirements-session-planner.md)
- [Persistence Contract](../contract/contract-session-planner-persistence.md)
- [Architecture](../architecture/architecture-session-planner.md)
- [Encounter Domain](../../encounter/domain/domain-encounter.md)
- [Session Generation Domain](../../sessiongeneration/domain/domain-session-generation.md)
