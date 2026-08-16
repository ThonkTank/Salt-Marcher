# Session Generation Rule Provenance

## Versioned Source Boundary

Runtime generation uses only checked, immutable local catalog artifacts. The
active artifact is `resources/sessiongeneration/catalog-2026-08-16`; the prior
`catalog-2026-07-16` artifact remains registered for historical runs. Runtime
and tests never read the live spreadsheet.

- source URL: `https://docs.google.com/spreadsheets/d/106AZXUTiRqKQ3bvh7FILYkZoHX1S_rAHZ4EcH7u2ino`
- source SHA-256: `a3bb89c04b40beb65eb6e344a6a8e8e8f6570cde7b75012aa778b5555b64aac2`
- active catalog version: `catalog-2026-08-16`
- active catalog content SHA-256:
  `59f4a9ab7b7164b9151d5339f41136701efa45a58666ee1cab7cff101b224a03`
- reward behavior profile: `reward-v2`
- encounter behavior profile: `encounter-v5`

The manifest fixes all 21 tables' row/column counts, headers, and hashes. The
registry and catalog checker verify them before typed data reaches a stage.

## Rule-To-Owner Map

| Rule family | Checked/configured inputs | Owning stage | Reference evidence |
| --- | --- | --- | --- |
| Session XP and exact encounter allocation | `DB_Progression.tsv`, Config V4 | Party basis and Encounter allocation | rational allocation and Encounter Golden tests |
| Cumulative post-XP gold target | `DB_Progression.tsv` XP/gold anchors imported as editable Config-V4 anchors | Reward basis | mixed-XP, level boundary, and 355,000-XP cap tests |
| Rarity targets across crossed XP bands | `DB_Progression.tsv` rarity rates imported into Config V4 | Reward basis | integrated rarity and probabilistic rounding tests |
| Encounter CR facts | `DB_CR.tsv` | Encounter candidate construction | CR parser and selector tests |
| Encounter role eligibility | `DB_EncounterRoleBands.tsv` | Encounter composition | role-band tests |
| Encounter pattern composition | `DB_EncounterPatterns.tsv` | Encounter composition | pattern and candidate tests |
| Treasure channels and themes | `DB_Themes.tsv`, Config-V4 channel shares and counts | Treasure planning | Session/Group structural regressions |
| Slot roles and forms | `DB_LootMix.tsv`, Config-V4 role/form mix | Slot and role planning | twelve Sheet structural regressions |
| Quantity limits | `DB_LootQuantityRules.tsv`, Config-V4 quantity tables | Non-magic selection | default parity and quantity tests |
| Candidate scoring policy | `DB_LootSelectionPolicy.tsv`, Config-V4 fit, jitter, penalty, and shortlist values | Non-magic and magic selection | policy parity and shortlist tests |
| Coin denominations | `DB_CoinDenominations.tsv`, Config-V4 values and labels | Coin selection and aggregation | denomination integrity tests |
| Coin profiles | `DB_CoinProfiles.tsv`, Config-V4 profile mappings | Coin selection | profile parity and budget tests |
| Ordinary candidates | `DB_LootItems.tsv`, `DB_LootSources.tsv` | Non-magic selection | carrier, adorned, useful, and flavor tests |
| Modifier composites | `DB_LootModifiers.tsv` | Non-magic selection and definition assembly | modifier/component fit tests |
| Relationship eligibility | `DB_LootRelations.tsv` only | Selection and packing indexes | relation addressability and fallback tests |
| Magic decision and rarity bands | `DB_MagicItems.tsv`, `DB_MagicDecisionTypes.tsv` | Magic selection | rarity and decision-path tests |
| Magic variants | `DB_MagicVariants.tsv` | Magic definition assembly | variant structural tests |
| Spells and enspelling | `DB_Spells.tsv`, `DB_EnspelledRules.tsv` | Magic definition assembly | spell and enspelled boundary tests |
| Curses | `DB_MagicCurses.tsv` and Config-V4 curse chance | Magic definition assembly | curse eligibility tests |
| Packing and output grammar | `DB_Containers.tsv`, `DB_LootRelations.tsv`, Config-V4 fill/loose/pile/bulk rules | Packing | capacity, hidden-container, relation, and grammar tests |

CR, encounter role bands, and encounter patterns remain catalog facts owned by
the unchanged encounter pipeline. Config V4 exposes every effective Loot
constant with fixed typed keys for levels, roles, rarities, policy paths, and
denominations. Derived progression columns are not editable, preventing
contradictory curves.

## Result And Randomness Contract

The engine may use a simple injected random source. Exact candidate choices,
formatted output, and spreadsheet seed multipliers are not compatibility
contracts. A completed run stores its selected definitions, component
references, quantities, packing, warnings, audits, reward basis, preset
identity/hash, and catalog identity. That immutable result—not algorithmic RNG
stability—is the replay authority after restart.

Group rewards use only the clamped normal ledger deficit and never overstock.
Session rewards distribute the normal deficit across the plan and report their
configured overstock separately. Hard/soft audit decisions use stable codes
and configured thresholds, not localized text.

## Change Rule

A formula, configuration meaning, stage boundary, hard audit, or result shape
change updates the reward engine version and focused evidence. A catalog-row
change publishes a new immutable artifact and content hash. Existing artifacts
and saved run definitions remain addressable.

## References

- [Session Generation domain](../domain/domain-session-generation.md)
- [Session Generation requirements](../requirements/requirements-session-generation.md)
- [Loot requirements](../../loot/requirements/requirements-loot.md)
