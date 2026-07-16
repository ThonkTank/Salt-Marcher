Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Items reference vocabulary and invariants.

# Items Domain Model

## Owned Truth

Items owns a replaceable local projection of public-source item records. An
item is identified by its stable source key and includes its name, equipment
category, optional subcategory, magic status, optional rarity, attunement
status, optional cost and weight, descriptive properties, and source URL.

## Invariants

- source keys are unique within the pinned source version
- catalog records are read-only between complete imports
- one import publishes either a complete replacement or no replacement
- equipment and magic-item feeds that describe the same source key produce one
  deterministic record
- absent source fields remain absent; they are not invented from display text
- inventory ownership, loot assignment, and user-authored item changes belong
  outside Items
