# Encounter Table Feature Spec

## Goal

Let campaign authors create and maintain weighted encounter tables and use them
as candidate sources for Scene-group generation.

## Non-Goals

- assigning loot tables
- resolving or rolling loot

## Expected Capabilities

- list, create, edit, and delete campaign-local encounter tables
- edit name, description, and unique weighted creature entries (`1..10`)
- load all encounter table summaries for Catalog and generator controls
- expose each table's optional linked loot-table ID
- load generation candidates for selected table IDs with an XP ceiling
- carry each candidate's table weight into encounter ranking
- return an empty candidate list for empty table selections

## User-Visible Behavior

- table creation and editing reuse the Scene group-management surface: the
  same filtered creature catalog is shown on the left and the selected or new
  table draft is shown on the right
- the Catalog keeps its table overview; selecting or creating a table opens
  that shared manager
- a faction may open the same table manager above its own editor; saving a new
  table returns to the unchanged faction draft and selects the new table
- selecting no effective encounter tables means the generator visibly falls
  back to the normal monster catalog source and current creature filters
- selecting one or more encounter tables means generation uses only creatures
  present in those selected tables
- all standard creature filters additionally constrain selected table sources
- multiple selected tables with different linked loot-table IDs show a
  non-blocking `Loot-Konflikt` warning

## Acceptance Criteria

- encounter-table data is exposed only through the Encounter Table feature
  boundary
- writes are optimistic and revision checked
- deleting a table removes location links and clears matching faction primary
  table references and their derived inventory limits in the same database
  transaction
- table selection does not create or persist encounter state
- an effective empty table or a table emptied by filters produces a clear
  no-solution result, not a catalog fallback

## References

- [Encounter Table Domain Model](../domain/domain-encountertable.md) (line 1)
- [Encounter Table Persistence](../contract/contract-encountertable-persistence.md) (line 1)
- [Encounter Feature Spec](../../encounter/requirements/requirements-encounter.md) (line 1)
