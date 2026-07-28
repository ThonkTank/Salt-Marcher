# Encounter Feature

Status: Active Godot migration owner
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the files below

Encounter owns persistent saved-plan rosters and runtime truth for encounter
creation and play. Its current Godot slice stores manual/generated plans and a
separate versioned runtime-context collection in the active Campaign's
immutable `encounter` partition. The
Katalog can search, inspect, create, edit, move to recoverable trash, restore,
and reopen those records after a complete scene reconstruction. Creature
definitions stay installation-owned; saved plans retain only stable IDs,
positive quantities, ordered roster position, and a last-known display-name
fallback.

The Godot owner also prepares one complete ordered Session Generation intent
batch from one current Creature snapshot and active-Party snapshot, commits all
plans atomically and idempotently, and hydrates requested summaries in order.
The production `Encounter` route opens one saved plan through current Creature
facts, imports the active Party into initiative, expands quantities into
individual combatants, persists HP/round/turn state, derives results, publishes
one atomic Encounter-plus-Party XP award, and returns to the retained roster.
Free-form Party-balanced builder generation, Scene context synchronization,
mob/reinforcement projections, and final compact state-pane composition remain
target work. JavaFX/SQLite implementations are migration evidence only and are
not called by the Godot product.

## Documentation Set

- [Feature Requirements](requirements/requirements-encounter.md)
- [Runtime State UI](requirements/requirements-encounter-state-tab.md)
- [Domain Model](domain/domain-encounter.md)
- [Architecture](architecture/architecture-encounter.md)
- [Persistence](contract/contract-encounter-persistence.md)
- [Saved Plans Contract](contract/contract-encounter-saved-plans.md)
- [Plan Budget Contract](contract/contract-encounter-plan-budget.md)
- [Builder Inputs Contract](contract/contract-encounter-builder-inputs.md)
- [Encounter State Contract](contract/contract-encounter-state.md)
- [Generated Preparation Contract](contract/contract-encounter-generated-import.md)
- [Runtime Context Contract](contract/contract-encounter-runtime-contexts.md)
- [Encounter Table Feature](../encountertable/README.md)

## Current Production Evidence

- pure payload validation rejects empty, duplicate, malformed, and damaged
  rosters;
- one serial generation-bound writer refreshes exact Creature identities and
  last-known names before create/update publication;
- bounded Catalog queries and a separate latest-wins detail lane release all
  worker state and reject stale Campaign/definition generations;
- the editor materializes at most 50 roster rows while retaining the complete
  ordered authored set;
- create, edit, trash, restore, search, current-label hydration, rejected
  missing references, and restart readback run through the production shell;
- generated preparation resolves all intents jointly and deterministically,
  distinguishes invalid/unresolvable/cancelled work, and publishes no partial
  draft;
- one serial owner write commits the complete generated batch, exact retries
  produce no new Campaign generation, conflicting retries write nothing, and
  ordered summaries distinguish found, missing, and unresolvable plans after
  controller reconstruction;
- the warmed two-level-3/two-level-4 reference workload records prepare,
  commit, and summary phases separately and keeps the complete three-Encounter
  route below the two-second p95 target over 20 runs;
- the production manual runtime journey covers current-fact plan open, active
  Party initiative, deterministic per-member combat expansion, individual HP,
  persisted round/active-turn restart truth, result derivation, atomic XP
  publication, and return to the unchanged runtime roster.
