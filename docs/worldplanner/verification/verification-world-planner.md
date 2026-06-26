Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-26
Source of Truth: Verification strategy and harness ownership for World
Planner documentation and later production behavior.

# World Planner Verification

## Purpose

This document defines how World Planner behavior, ownership, and persistence
rules are proven.

Wave 1 is documentation-only. Later waves must add production-path behavior
harness proof before claiming backend, UI, Encounter, Combat, or public
location-choice integration complete.

## Source Documents

Verified source documents:

- [World Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/worldplanner/requirements/requirements-world-planner.md:1)
- [World Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/worldplanner/domain/domain-world-planner.md:1)
- [World Planner Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/worldplanner/architecture/architecture-world-planner.md:1)
- [World Planner Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/worldplanner/contract/contract-world-planner-persistence.md:1)

## Wave 1 Documentation Proof

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

Combat lifecycle harness proof is required for:

- NPCs added to combat preserve World Planner identity
- combat does not mutate World Planner durable state before manual
  confirmation
- confirmed losses mark named NPCs defeated or reduce finite stock according
  to World Planner domain rules
- reactivation restores named NPC availability

Public location-choice integration harness proof is required for:

- World Planner exposes selectable location references through its public
  boundary
- consumers can read those references without copying World Planner location
  truth
- World Planner verification does not define Session Planner-owned session
  record shape or scene behavior

UI harness proof is required for:

- World Planner left-bar tab discovery
- NPC details publication to the shell details/Inspector surface
- faction and location editors mutate only through World Planner public
  boundaries
- view-local draft state does not become durable truth without domain readback

## Known Harness Gaps

- no World Planner backend behavior harness exists yet
- no World Planner left-bar UI harness exists yet
- no focused Encounter combat/result harness exists for NPC loss confirmation
- no World Planner public location-choice readback harness exists yet

These are expected later implementation obligations. Session Planner-owned
scene behavior remains outside the World Planner verification owner. Manual
testing may supplement but must not replace available production-path harness
proof.

## References

- [Quality Platforms](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [World Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/worldplanner/requirements/requirements-world-planner.md:1)
- [World Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/worldplanner/domain/domain-world-planner.md:1)
