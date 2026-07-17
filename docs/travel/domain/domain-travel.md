Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-17
Source of Truth: Global travel-context ownership, published language, and
cross-feature invariants.

# Travel Context Domain

## Context Role

Context Role: Active Party Travel Context
Context Name: Travel

Travel is a read-only orchestration feature. It consumes party-owned runtime
position and feature-owned Dungeon or Hex travel readback, selects the matching
context, and publishes one compact global state. It owns no authored map truth,
party position, route validation, movement command, or persistence.

## Published Language

`TravelContextSnapshot` is immutable and revisioned. It contains:

- context kind: none, Dungeon, or Hex
- location or map label
- area or local-context label when available
- tile or coordinate text
- heading or equivalent movement orientation when available
- movement status and concise hint
- source revision and selected party-position revision

Feature-owned APIs publish typed compact readback; Travel does not parse display
text from editor state or inspect feature persistence.

## Ownership And Composition

- `features/travel` owns `TravelContextApi`, context selection, and the single
  global `Reise` shell contribution
- `features/party` owns active party identity and persisted runtime position
- `features/dungeon` owns Dungeon movement semantics and compact Dungeon
  readback
- `features/hex` owns Hex movement semantics and compact Hex readback
- `app` injects Party, Dungeon, and Hex APIs into Travel explicitly

Travel has no SQLite adapter. Its current state is rebuilt from injected live
readbacks and is not restored as separate truth.

## Invariants

- exactly one global travel context is published for one active party-position
  revision
- a valid Dungeon position selects Dungeon context; a valid Hex or overworld
  position selects Hex context; absence or unresolved position selects explicit
  no-context state
- active editor selection never chooses the global travel context
- stale source readback never replaces a newer party-position revision
- the compact context is read-only and never dispatches movement
- Dungeon and Hex do not register competing global `travel` contribution keys

## References

- [Travel Docs](../README.md)
- [Global Travel State Requirements](../../project/requirements/requirements-travel-state-tab.md)
- [Dungeon Travel State Requirements](../../dungeon/requirements/requirements-dungeon-travel-state.md)
- [Hex Travel State Requirements](../../hex/requirements/requirements-hex-travel-state.md)
- [Party Domain](../../party/domain/domain-party.md)
