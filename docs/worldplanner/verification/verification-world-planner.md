Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: Verification strategy and harness ownership for World
Planner documentation and later production behavior.

# World Planner Verification

## Purpose

This document defines how World Planner behavior, ownership, and persistence
rules are proven.

The current implemented slice has production-path domain, persistence,
readback, minimal left-bar UI proof, Encounter source constraint integration,
Encounter result NPC-loss confirmation, and Session Planner
scene/location-reference metadata.

## Source Documents

Verified source documents:

- [World Planner Requirements](docs/worldplanner/requirements/requirements-world-planner.md:1)
- [World Planner Domain Model](docs/worldplanner/domain/domain-world-planner.md:1)
- [World Planner Architecture](docs/worldplanner/architecture/architecture-world-planner.md:1)
- [World Planner Persistence Contract](docs/worldplanner/contract/contract-world-planner-persistence.md:1)

## Documentation Proof

Mechanically enforced:

- `./gradlew checkDocumentationEnforcement --console=plain`

Review-owned:

- each World Planner document has required metadata
- each document stays within its canonical type
- requirements define behavior, not schema or topology
- domain defines ownership and invariants, not UI flow
- architecture defines topology and seams, not acceptance criteria
- contract defines stored truth and references, not user flow
- verification maps proof, not product meaning

## Backend Behavior Harness

Mechanically enforced for the current backend slice:

- `./gradlew worldPlannerBackendHarness --console=plain`

The backend harness proves current NPC, faction, location, lifecycle,
inventory-limit, persistence-reload, storage-error, and readback-only behavior.

## Later Behavior Harness Obligations

Backend harness proof is required for:

- NPC CRUD and statblock-reference round trips
- faction CRUD, NPC membership, primary encounter table, and inventory limits
- location CRUD, linked factions, and linked encounter tables
- active, defeated, and reactivated NPC lifecycle
- rejection of copied creature statblocks, encounter rosters, combat runtime
  state, party truth, dungeon maps, and hex maps

Encounter integration harness proof is required for:

- faction source selection
- location source selection
- selected-table and faction/location source intersection
- finite faction inventory caps
- unlimited default when no finite limit exists
- clear no-solution behavior when finite stock cannot satisfy generation
- World Planner NPC identity through Encounter builder, combat, and result
  state

Mechanically enforced for the current Encounter integration slice:

- `./gradlew worldPlannerEncounterHarness --console=plain`

The current implementation routes Encounter Planner faction and location IDs
through `EncounterBuilderInputs`, resolves World Planner faction/location
sources at generation time, intersects explicit table choices with
World Planner source tables, enforces finite statblock stock caps in draft
enumeration, and preserves selected World Planner NPC identity through
Encounter result publication.

Combat lifecycle harness proof is required for:

- NPCs added to combat preserve World Planner identity
- combat does not mutate World Planner durable state before manual
  confirmation
- confirmed named NPC losses mark those NPCs defeated according to
  World Planner domain rules
- reactivation restores named NPC availability

Public location-choice integration harness proof is required for:

- World Planner exposes selectable location references through its public
  boundary
- consumers can read those references without copying World Planner location
  truth
- World Planner verification does not define Session Planner-owned session
  record shape or scene behavior

Later UI harness proof is required for:

- NPC details publication to the shell details/Inspector surface
- faction and location editors mutate only through World Planner public
  boundaries
- view-local draft state does not become durable truth without domain readback

Mechanically enforced for the current left-bar UI slice:

- `./gradlew worldPlannerUiHarness --console=plain`

The UI harness proves the World Planner contribution bind route can create
NPCs, update NPC notes, toggle NPC lifecycle, create factions, link NPC
membership, set faction inventory limits, create locations, link factions, link
encounter tables, and render selected NPC detail notes from domain readback.
The World Planner view also exposes a selected-NPC action that adds the NPC to
the Encounter roster through the Encounter public boundary while carrying its
World Planner identity.

## Known Harness Gaps

- no focused finite-stock decrement confirmation exists for unnamed stock-only
  losses

Session Planner-owned scene behavior remains outside the World Planner
verification owner. Manual testing may supplement but must not replace
available production-path harness proof.

## References

- [Quality Platforms](docs/project/verification/quality-platforms.md:1)
- [World Planner Requirements](docs/worldplanner/requirements/requirements-world-planner.md:1)
- [World Planner Domain Model](docs/worldplanner/domain/domain-world-planner.md:1)
