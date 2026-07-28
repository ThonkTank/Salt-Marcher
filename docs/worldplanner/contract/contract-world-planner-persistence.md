# World Planner Persistence Contract

Status: Active Godot persistence contract
Owner: World Planner
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Owner

World Planner persists only World Planner-authored NPC, faction, location,
lifecycle, note, link, source-constraint, inventory-limit, Quest/rumour, and
recoverable-trash truth. Its Campaign owner key is exactly `worldplanner`.

The payload format is `saltmarcher.world-planner.v1`. It is stored through the
Campaign immutable-generation protocol as a checksummed owner partition; World
Planner owns no database, schema registry, mutable sidecar, or Catalog cache.

## Payload Shape

The payload contains one active-record map and one trash map. Both are
keyed by stable lowercase portable IDs. Active and trash maps may not contain
the same identity.

Every record stores stable ID, kind, display name, general notes, created time,
and updated time. Kind-specific truth is:

- NPC: optional creature ID; appearance, behavior, history; active/defeated
  lifecycle; optional faction and last-place IDs; bounded disposition modifier;
- faction: optional primary encounter-table ID, bounded base disposition, and
  optional finite non-negative inventory limits by creature ID;
- place: unique faction IDs and unique encounter-table IDs.
- Quest: manual `open`/`closed` resolution, unique typed NPC/faction/place
  subjects, unique contributor IDs, and zero or more structured rewards;
- rumour: the same resolution and subject shape, an empty contributor list, and
  zero or more structured rewards.

An XP reward has exactly `kind: xp` and one positive integer `amount`. An item
reward has exactly `kind: item`, one portable `definition_id`, and one positive
integer `quantity`. These values are authored planning data only. This
partition performs no XP grant, inventory mutation, automatic completion, or
trigger evaluation.

A trash entry stores the complete record, deletion time, and the incoming owner
relationships removed by that deletion. The current provider excludes trash;
the trash provider returns it explicitly. Both views validate a `name` or
`identity` sort key, apply the selected direction with stable-ID tie-breaking,
and only then slice the requested bounded page.

## Identity And Minimal Creation

Identity is generated once and does not change on rename, deletion, or restore.
Display names need one visible character and may be shared by several records
of the same or different kind. Creation requires only name and kind; every
other field receives an empty, active, unlimited, or neutral default as
appropriate.

## Commit And Concurrency

A command snapshots Campaign ID, activation generation, Campaign generation,
runtime state, and current partition reference. It reads and validates the
partition and computes one complete candidate off-thread. Only the admitted
Campaign runtime may submit it. The serial writer publishes the candidate and
unchanged runtime in one new immutable Campaign generation.

Stale activation, stale Campaign generation, revoked authority, concurrent
accepted writes, preparation failure, validation failure, and storage failure
publish no new World Planner truth. The last confirmed generation remains
readable. Completion is collected through a bounded write ticket; provider
controls remain busy until that terminal result is observed.

## Deletion And Restore

Deletion is recoverable and atomic with current relationship cleanup:

- deleting an NPC removes it from active membership by moving that NPC record;
- deleting a faction clears NPC `faction_id` values and removes the faction
  from place faction links in the same candidate;
- deleting a place clears current NPC `last_place_id` values and otherwise
  moves only the place;
- deleting an NPC, faction, or place removes that subject from every active
  Quest or rumour in the same candidate;
- deleting a Quest or rumour moves the complete narrative record, including
  resolution, subjects, contributors, and rewards;
- removing a relationship alone never deletes either endpoint.

Restore republishes the original identity. Its outgoing and saved incoming
relationships are restored only when the other endpoint remains active and the
relationship slot is not already claimed. Missing or conflicting links stay
absent and do not block restoration of the record.

## Validation And Failure Isolation

- IDs are bounded portable lowercase storage IDs;
- names and text fields are bounded;
- dispositions are mathematical integers from `-50` through `+50`, including
  integral values produced by a JSON round trip;
- finite inventory limits are mathematical non-negative integers;
- active internal faction/place references resolve to an active record of the
  required kind;
- active narrative subjects resolve to active World Planner entities of their
  declared kind and reject duplicate kind/ID pairs;
- rumours reject contributors; Quest contributor IDs are unique portable
  foreign references and do not copy Party truth;
- rewards have an exact supported shape and positive integral quantity;
- relationship arrays reject duplicate identities;
- malformed partition or trash data fails the World Planner provider only and
  does not prevent Campaign registry or unrelated owner-partition reads;
- errors expose owned statuses and messages, not paths or raw storage details.

Compatibility obligations begin with the first released format. Until then,
unsupported development payloads are disposable; the provider performs no
implicit repair, conversion, SQLite import, or dual write.

## References

- [World Planner Requirements](../requirements/requirements-world-planner.md)
- [World Planner Domain Model](../domain/domain-world-planner.md)
- [World Planner Architecture](../architecture/architecture-world-planner.md)
- [Campaign Persistence Contract](../../project/contract/persistence-lifecycle.md)
