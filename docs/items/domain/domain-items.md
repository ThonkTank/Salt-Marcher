Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Items reference vocabulary and invariants.

# Items Domain Model

## Context Role

Context Role: Imported Reference Catalog Context

Context Name: Items

Items owns the complete, replaceable local reference projection of the pinned
public equipment and magic-item corpus. It does not own inventory, loot,
assignment, crafting, or user-authored item truth.

## Published Language

`ItemsCatalogApi` publishes item queries, typed catalog statuses, filter
options, result pages, item rows, and item details. `ItemsImportApi` publishes
the explicit full-corpus import result and its typed status.

## Application Boundary

The application boundary normalizes catalog queries and coordinates public
source loading, batch validation, verified backup, and whole-catalog
replacement. It translates domain catalog values into immutable API carriers;
it does not create missing reference facts or expose persistence shape.

## Write Model And Derived State

The only write model is one validated full-corpus import batch. An
item is identified by its stable source key and includes its name, equipment
category, optional subcategory, magic status, optional rarity, attunement
status, optional cost and weight, descriptive properties, and source URL.

Derived state consists of distinct filter options, filtered and ordered result
pages, and one selected item detail. Derived results never mutate imported
truth.

## Invariants

- source keys are unique within the pinned source version
- catalog records are read-only between complete imports
- one import publishes either a complete replacement or no replacement
- both the equipment and magic-item indexes and every referenced detail are
  fetched and parsed before validation permits any database maintenance
- equipment and magic-item feeds that describe the same source key produce one
  deterministic record
- absent source fields remain absent; they are not invented from display text
- inventory ownership, loot assignment, and user-authored item changes belong
  outside Items

## Consistency Boundary

One import batch is the consistency boundary: readers observe either the prior
complete projection or the replacement complete projection. A catalog query or
detail lookup is internally consistent for that single request; later requests
may observe a newer completed import.

## References

- [Items Catalog](../requirements/requirements-items-catalog.md)
- [Items Persistence And Import](../contract/contract-items-persistence.md)
