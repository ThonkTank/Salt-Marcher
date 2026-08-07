# World Planner Persistence Contract

## Purpose

This contract defines the persisted storage boundary for the `worldplanner`
feature.

World Planner persistence stores only World Planner-authored NPC, faction,
location, lifecycle, note, link, source-constraint, and inventory-limit truth.

## Adapter Boundary

- The World Planner SQLite adapter satisfies feature-owned application ports
  and remains private to the World Planner composition entry point.
- The application composition supplies `WorldPlannerApi` explicitly;
  registry, discovery, mutable published models, repositories, gateways,
  mappers, schema classes, and source records are not public boundaries.
- SQL records and adapter failures MUST NOT cross `WorldPlannerApi`.

## Stored Truth

World Planner persistence stores:

- NPC identity, display name, creature statblock reference, lifecycle status,
  appearance notes, behavior notes, history notes, general notes, and bounded
  PC-disposition modifier
- faction identity, display name, notes, primary encounter-table reference,
  bounded PC-disposition base, and NPC membership
- faction statblock inventory limit rows, including whether a statblock is
  finite or unlimited
- location identity, display name, ordered free-form tags, separate read-aloud
  text and GM notes, linked factions, and linked encounter tables
- normalized World Location save-command input and its durable complete or
  partial receipt, keyed by one stable command identity

The active Electron slice materializes location and faction metadata, faction
inventory, location-to-faction links, and location-to-table links. Foreign
creature and encounter-table IDs remain logical references; cross-owner
referential cleanup is orchestrated in one utility-process transaction.

World Planner persistence does not store:

- creature statblock fields
- encounter-table membership rows
- post-combat runtime state or pending loss-confirmation workflows
- saved encounter-plan rosters
- party membership or character details
- combat HP, initiative, turn order, or runtime result state
- dungeon map or hex map truth
- Session Planner records, notes, or selected session truth

## Reference Rules

- NPC statblocks are stored as stable creature IDs.
- Faction and location encounter sources are stored as stable encounter-table
  IDs.
- Later Session Planner-owned integration may store location references in
  Session Planner, not copied location data in World Planner.
- Foreign truth must be re-read through the owning public boundary when a
  World Planner projection needs display facts.
- Missing optional source constraints mean unconstrained.
- Missing statblock inventory limits mean unlimited.
- Explicit finite inventory limit `0` means none available for that statblock.
- A faction inventory row is valid only while the creature belongs to that
  faction's primary encounter table. Changing or deleting the reference and
  removing a table entry prune invalid rows in the same transaction.
- NPC membership rows enforce at most one faction for each NPC.

## Validation And Error Behavior

Startup validates the one whole-database development schema version; semantic
row validation remains on typed provider read/write paths and fails closed
through the feature contract. World Planner owns its DDL and SQL but no
independent schema version or migration ledger.

The `worldplanner_location_save_operation` journal table is owned by the World
Planner location aggregate. Its adapter commits the base Location mutation and
the provisional partial receipt together. The cross-aggregate application
handler receives that adapter as a port and must not prepare SQL itself.

- Writes must reject malformed NPC, faction, location, creature statblock, or
  encounter-table references.
- Location tags are stored as ordered location-owned rows. Every location has
  between one and twenty non-empty values of at most forty characters. A
  normalized key prevents case-only or Unicode-normalization duplicates; no tag
  registry or type enum is persisted.
- Tag suggestions are a bounded read projection over those relational rows.
  The query returns at most ten canonical-distinct display values, preserves
  the first authored spelling, and does not expose a mutable tag registry.
- Writes must reject duplicate membership or duplicate link rows instead of
  silently persisting ambiguous truth.
- NPC deletion must remove faction membership in the same saved state.
- Faction deletion must remove location links in the same saved state.
- Removing a relationship must leave both referenced records intact.
- Disposition values must remain between `-50` and `+50`.
- Finite inventory limits must be non-negative.
- Inventory writes without a primary table or for creatures outside that table
  must fail validation.
- A faction must not persist more than one primary encounter-table reference.
- Candidate combat losses must not mutate durable NPC lifecycle or faction
  stock until user confirmation is recorded.
- Storage and schema failures must surface through World Planner API result
  statuses instead of leaking SQLite exceptions to consumers.
- Failed writes must leave the last stable revisioned World Planner API state
  visible.

## Current Schema Lifecycle

World Planner is a feature-owned persistence surface. It does not migrate
existing Session Planner, Encounter, EncounterTable, Creatures, Party, Dungeon,
or Hex tables in the current backend slice.

Compatibility obligations begin with the first released format.
Before the first released format, shared startup creates the complete current
whole-database development schema directly. World Planner owns its DDL and SQL
but no independent version or ledger. Unsupported isolated development
databases are discarded and recreated without feature-local `ALTER`, repair,
membership normalization, copy, drop, or version claims.

The deterministic example-data command, optional diagnostic export, and the
release criteria that end this reset policy are defined by the
[data format freeze checklist](../../project/architecture/data-format-freeze-checklist.md).

Later Session Planner-owned references to World Planner locations belong to the
Session Planner persistence contract and do not change this owner boundary.


## References

- [World Planner Domain Model](../domain/domain-world-planner.md) (line 1)
