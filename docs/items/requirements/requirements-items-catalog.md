Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Observable Items Catalog behavior and acceptance criteria.

# Items Catalog

## Goal

Provide a fast local reference list for public-SRD equipment and magic items
inside the shared Catalog.

## Visible Behavior

- `Items` appears directly after `Monster` in the Catalog content strip.
- Name, category, subcategory, rarity, magic status, attunement status, and
  cost can narrow the list.
- Name, category, rarity, and cost can order the list.
- Selecting an item opens description, properties, cost, weight, rarity,
  attunement, damage or armor facts when available, and source attribution in
  the Inspector.
- Empty, invalid-filter, loading, unavailable-data, and storage-error states
  are explicit.
- The surface contains no create, edit, delete, loot generation, assignment,
  or inventory action.

## Acceptance Criteria

- browsing imported items performs no network request
- Items content never replaces the global Encounter state pane
- every displayed item is attributable to the pinned public source import
- filtering, sorting, paging, and Inspector selection use only the local
  imported projection
- a missing import is an isolated Items unavailable state and does not break
  other Catalog contents
- no Item UI or application command mutates imported item truth
