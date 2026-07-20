Status: Active Target
Owner: Encounter Feature
Last Reviewed: 2026-07-18
Source of Truth: Encounter structure, generated-batch orchestration,
publication, execution, and quality decisions.

# Encounter Architecture

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
- Verification maintainers need deterministic batch fixtures, query bounds,
  atomic failure proof, and stage timing.

This document owns Encounter structure and quality decisions. User-visible
behavior belongs to requirements, write-model truth to the domain, and command,
compatibility, and persistence semantics to contracts.

## Topology And Dependency Direction

```text
features/encounter/api/
features/encounter/domain/
features/encounter/application/
features/encounter/adapter/sqlite/
features/encounter/adapter/javafx/
features/encounter/EncounterFeature
```

Domain code depends on no API carriers, SQL, JavaFX, platform service, or
foreign feature. Application code translates public commands and foreign API
results, invokes Encounter policies, and depends outward only on
feature-owned ports. SQLite and JavaFX adapters implement those ports.
Composition is the only construction point.

Encounter may consume `PartyApi`, `CreaturesApi`, `EncounterTableApi`, and
`WorldPlannerApi`. Session Planner consumes `EncounterApi`; Encounter never
calls Session Planner or Session Generation and never reads a foreign
repository or table directly.

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

Manual builder generation remains an independent application use case but uses
the same Encounter math, candidate, ranking, and saved-plan invariants. It does
not create a second plan model or generated-batch writer.

## Execution

- command dispatch and immutable snapshot application are the only Encounter
  work allowed on the JavaFX thread
- foreign reads and SQLite work run on I/O execution
- deterministic candidate evaluation and roster construction run on bounded
  CPU execution
- candidate search never runs inside a database transaction
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
revisioned Encounter state. Generated-batch completion does not mutate those
runtime sessions. Saved-plan summary batch reads preserve request order and
report missing identities explicitly.

## Quality Targets

- one generated prepare performs one candidate-snapshot read for the complete
  intent union; query count is independent of Encounter, CR/role-block, and
  selected-roster-member cardinality
- commit uses one Encounter transaction with set-based plan, roster, and origin
  writes and exposes no partial rows
- one workspace hydration request uses one saved-plan summary batch read rather
  than one read per scene or plan
- deterministic fixture replay yields the same ordered concrete rosters for
  the same intent batch, candidate snapshot, engine meaning, and preparation
  identity
- the shared warmed fixture of three generated Encounters records candidate
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
- permanent historical-origin read compatibility coexists with one canonical
  write representation

Rejected alternatives:

- abstract XP/role slot persistence as a saved Encounter plan
- exact-XP point queries per slot or creature-detail reads per roster member
- first-match selection that accidentally repeats equivalent rosters
- one transaction per generated Encounter or a duplicate generated-origin
  writer
- rewards, packing, audits, session scenes, or copied creature statblocks in
  Encounter persistence
- cross-feature database access, JavaFX orchestration, a shared workflow
  transaction, or compensating deletion

## Enforcement And Proof

Architecture enforcement rejects foreign implementation imports, repositories
crossing `EncounterApi`, JavaFX-owned orchestration, and a second saved-plan
write model. Production-route proof owns ordered all-or-nothing preparation,
idempotent equal retry, conflicting retry, atomic rollback, bounded candidate
and summary reads, deterministic roster quality, and JavaFX passivity.

## References

- [Requirements](../requirements/requirements-encounter.md)
- [Domain](../domain/domain-encounter.md)
- [Generated Preparation Contract](../contract/contract-encounter-generated-import.md)
- [Encounter Persistence](../contract/contract-encounter-persistence.md)
- [Session Planner Architecture](../../sessionplanner/architecture/architecture-session-planner.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
