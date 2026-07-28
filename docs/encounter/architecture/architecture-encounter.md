# Encounter Architecture

Status: Active target architecture with saved-plan, generated-batch, and manual runtime Godot implementation
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Objective

Encounter provides manual and generated roster construction while remaining the
only owner of saved Encounter-plan truth. Generated preparation resolves one
ordered intent batch into concrete rosters before any write and publishes the
complete saved-plan mapping only after one successful idempotent batch commit.

## Stakeholders And Concerns

- Game masters need useful concrete rosters, stable saved plans, and unchanged
  visible state when preparation fails.
- Session Planner needs one ordered all-or-nothing batch seam and bounded
  summary reads.
- Party, Creatures, Encounter Table, and World Planner maintainers need their
  facts consumed only through public APIs.
- Encounter maintainers need one saved-plan write model shared by manual and
  generated flows.

This document owns Encounter structure and quality decisions. User-visible
behavior belongs to requirements, write-model truth to the domain, and command,
compatibility, and persistence semantics to contracts.

## Topology And Dependency Direction

```text
godot/src/features/encounter/
  encounter_plan_knowledge.gd
  encounter_plan_command_controller.gd
  encounter_plan_detail_read_controller.gd
  encounter_generation_policy.gd
  encounter_generated_batch_read_controller.gd
  encounter_generated_batch_command_controller.gd
  encounter_runtime_knowledge.gd
  encounter_runtime_read_controller.gd
  encounter_runtime_command_controller.gd
  # target: free-form generation and planning-fact controllers
godot/src/ui/
  encounter_plan_editor_dialog.gd
  encounter_runtime_workspace.gd
  scene_workspace.gd
  # target: compact cockpit state-pane composition
```

Pure owner code depends on no UI node, file path, Campaign store, or foreign
feature. Application controllers translate commands and foreign results,
invoke Encounter policies, and use only the feature-neutral Campaign and
Shared-Definition mechanisms. UI nodes dispatch typed intents and render
immutable results. Composition is the only construction point.

Encounter may consume `PartyApi`, `CreaturesApi`, `EncounterTableApi`, and
`WorldPlannerApi`. Session Planner consumes `EncounterApi`; Encounter never
calls Session Planner or Session Generation and never reads a foreign
repository or table directly.

Creature catalog truth is installation-owned while Encounter saved plans are
Campaign-owned. Encounter validates and refreshes Creature references through
the selected Shared-Definition generation, then stores only the positive
identity and a last-known display-name snapshot. No storage relation crosses
those owner stores.

Current production coverage includes the saved-plan owner partition, serial
writer, bounded Catalog query, latest-wins detail hydration, recoverable trash,
bounded roster editor, deterministic generated-batch policy, asynchronous
prepare/summary lane, and atomic idempotent batch publication. The free-form
Encounter alternative generator and Session Planner planning facts are not yet
composed and must not be inferred from the batch seam. A separate top-level
Encounter workspace now owns the manual live path plus any selected Scene
context: open saved plan, initiative, individual combatants, HP/turn mutation,
results, atomic Party XP award, and return to the retained roster. The Scene
command controller resolves current Party, World Planner, plan, and Creature
facts, then uses pure Encounter reconciliation before one atomic Scene-plus-
Encounter Campaign commit. Final compact cockpit placement remains target work.

## Generated-Batch Orchestration

```text
prepareGeneratedBatch(command)
  -> validate complete ordered intent batch
  -> load one union creature-candidate snapshot
  -> resolve and validate every concrete roster in memory
  -> publish complete prepared batch or one failure

commitGeneratedBatch(command)
  -> validate identity, batch fingerprint, and every EncounterPlan
  -> write all plans, roster rows, and canonical generated origins
  -> publish complete ordered plan mapping or one failure
```

Prepare and commit are separate because Session Planner must validate the whole
cross-feature preparation before Encounter truth becomes durable. The prepared
batch is transient typed state. Commit creates ordinary `EncounterPlan`
aggregates and retains generated origin only for audit and idempotency.

The production read lane captures one active-Party snapshot and one complete
Creature snapshot, resolves all intents jointly with deterministic role-aware
selection and deliberate roster diversity, and confirms Campaign plus
Shared-Definition generations before publication. The writer validates the
complete prepared shape in memory and submits one `encounter` partition
replacement through the admitted Campaign writer. An exact completed retry is
a no-write readback; changed meaning for the same engine/preparation identity
is a conflict.

Manual builder generation remains an independent application use case but uses
the same Encounter math, candidate, ranking, and saved-plan invariants. It does
not create a second plan model or generated-batch writer.

## Execution

- command dispatch and immutable snapshot application are the only Encounter
  work allowed on the Godot scene-tree thread
- foreign reads and file-store work run on worker execution
- deterministic candidate evaluation and roster construction run on bounded
  CPU execution
- candidate search never runs inside a file-store publication boundary
- cancellation stops avoidable preparation work before commit; a commit that
  has started resolves as one complete success or failure
- preparation is not submitted as one global serial chain

## Publication Semantics

Prepare publishes one complete ordered `PreparedEncounterRoster` batch or no
applicable batch. Commit publishes one complete ordered Encounter-number-to-plan
mapping or no mapping. A validation, resolution, conflict, cancellation, or
storage failure does not publish a partial set and does not advance visible
saved-plan state.

Runtime builder, initiative, combat, and result state is published as immutable
revisioned Encounter state. The manual context already uses this route and
publishes each mutation through one validated owner replacement;
generated-batch completion does not mutate it. Scene contexts use the same
runtime language and are selected by an explicit context ID; focus changes do
not reset any parallel context. Saved-plan summary batch reads preserve request
order and report missing identities explicitly.

## Quality Targets

- one generated prepare performs one candidate-snapshot read for the complete
  intent union; query count is independent of Encounter, CR/role-block, and
  selected-roster-member cardinality
- commit uses one complete Encounter owner-partition publication containing
  plan, roster, and origin values and exposes no partial batch
- one workspace hydration request uses one saved-plan summary batch read rather
  than one read per scene or plan
- deterministic reference-input replay yields the same ordered concrete rosters for
  the same intent batch, candidate snapshot, engine meaning, and preparation
  identity
- the shared warmed workload of three generated Encounters records candidate
  load, roster construction, commit, and summary hydration separately and fits
  within the Session Planner 2-second p95 end-to-end target over 20 runs

## Durable Decisions And Rejected Alternatives

Chosen decisions:

- concrete creature identities and positive quantities exist for the complete
  batch before any write
- one union candidate snapshot supports joint deterministic selection and
  deliberate roster diversity
- one idempotent generated-batch commit is the publication boundary
- manual and generated plans share `EncounterPlan` ownership and invariants
- one canonical generated-origin representation is used for both read and
  write; incomplete pre-completion origin shapes are invalid disposable state
- one empty-namespace current-v1 initializer and an exact read-only schema
  signature replace additive schema repair before feature completion

Rejected alternatives:

- abstract XP/role slot persistence as a saved Encounter plan
- exact-XP point queries per slot or creature-detail reads per roster member
- first-match selection that accidentally repeats equivalent rosters
- one publication per generated Encounter or a duplicate generated-origin
  writer
- rewards, packing, audits, session scenes, or copied creature statblocks in
  Encounter persistence
- cross-feature storage access, UI orchestration, a shared workflow commit, or
  compensating deletion
- a Campaign-to-installation Creature foreign key or copied Creature catalog
  table inside the Campaign store


## References

- [Requirements](../requirements/requirements-encounter.md)
- [Domain](../domain/domain-encounter.md)
- [Generated Preparation Contract](../contract/contract-encounter-generated-import.md)
- [Encounter Persistence](../contract/contract-encounter-persistence.md)
- [Session Planner Architecture](../../sessionplanner/architecture/architecture-session-planner.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
