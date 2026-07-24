Status: Active Target
Owner: Session Planner Feature
Last Reviewed: 2026-07-21
Source of Truth: Session Planner language, authored truth, and invariants.

# Session Planner Domain Model

## Context Role And Ownership

Context Name: `SessionPlanner`

Context Role: Authored Session Preparation Context

Session Planner owns the editable preparation record for one session. Party,
Encounter, Creatures, World Planner, and Session Generation retain their own
truth. Encounter templates are cloned into independent Encounter-owned plans
before a scene links them. Generated treasure output is materialized as
Planner-owned editable truth.

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
- ordered scene-owned treasures with title, note, channel, stock, theme, magic
  type, target value, slots, item facts, packing facts, and ordering

It does not embed party details, Encounter rosters, creature details, World
Planner records, generation-run identity, audits, or engine metadata.
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
- add, update, remove, and reorder one scene-owned treasure and its item or
  packing rows
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
- treasure identities are positive and unique within a Session and name an
  existing scene; they carry no generation-run identity
- encounter-channel rewards reference their generated Encounter scene; quest
  and environment rewards reference encounter-free scenes
- manual loot notes never masquerade as generated reward detail
- attaching or replacing a saved Encounter template first creates a distinct
  Encounter plan; deleting a scene alone prunes its manual notes and treasures
- a manual-note identity is session-local and every note mutation identifies
  both its owning scene and the exact Session revision it was authored from
- every authored mutation and preparation request, including catalog rename,
  delete, Generate, and replacement confirmation, carries the exact Session
  identity and revision visible at intent time; Current is a read and
  navigation pointer, never an implicit write target
- incomplete preparation never mutates `SessionPlan`
- prepared-content replacement applies to the exact session identity and
  revision it read; concurrent authored edits reject the replacement
- removing a scene removes its planner-owned treasures without deleting foreign
  generation runs or Encounter templates

## Derived State

Session Planner derives, without creating another write model:

- participant summaries and planning readiness
- budget, planned XP, remaining or exceeded XP, and rest guidance
- ordered scene summaries and selected-scene detail
- linked and attachable Encounter summaries
- scene-owned treasure snapshots and manual loot-note presentation
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
