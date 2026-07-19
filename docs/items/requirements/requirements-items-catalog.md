Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Observable Items Catalog behavior and acceptance criteria.

# Items Catalog

## Goal

Provide a fast local reference list for public-SRD equipment and magic items
inside the shared Catalog.

Affected users are game masters who need local rules-reference facts while
planning or running a session. Inventory management, loot generation,
assignment, crafting, and authored item editing are non-goals.

## Target Visible Behavior

- `Items` appears directly after `Monster` in the Catalog content strip.
- Name, category, subcategory, rarity, magic status, attunement status, and
  cost can narrow the list.
- Name, category, rarity, and cost can order the list.
- Selecting an item opens description, properties, cost, weight, rarity,
  attunement, damage or armor facts when available, and source attribution in
  the Inspector.
- Empty, invalid-filter, loading, unavailable-data, and storage-error states
  are explicit; an incompatible local Items schema is distinguished from a
  missing import.
- The surface contains no create, edit, delete, loot generation, assignment,
  or inventory action.

## Primary Flow

1. The game master opens `Items` in the shared Catalog.
2. The surface reports loading and then either a local result page, an empty
   result, unavailable imported data, an invalid filter, or a storage failure.
3. The game master narrows or orders the local result page.
4. Selecting a row shows its imported detail and source attribution in the
   Inspector without changing global Encounter state.

## Acceptance Criteria

- browsing imported items performs no network request
- Items content never replaces the global Encounter state pane
- every displayed item is attributable to the pinned public source import
- filtering, sorting, paging, and Inspector selection use only the local
  imported projection
- a missing import is an isolated Items unavailable state and does not break
  other Catalog contents
- an incompatible Items schema is an isolated Items failure and does not break
  Monster or other provider-backed Catalog contents
- no Item UI or application command mutates imported item truth
