# Session Generation rule provenance

## Versioned source boundary

Runtime generation uses only the checked catalog
`resources/sessiongeneration/catalog-2026-07-16`. The live spreadsheet is an
upstream authoring source and is never read by Runtime or tests.

- source URL: `https://docs.google.com/spreadsheets/d/106AZXUTiRqKQ3bvh7FILYkZoHX1S_rAHZ4EcH7u2ino`
- source SHA-256: `f87f6046444b7bf17814fae71c17802f4f875bfe4e4c9ec75574a1fc01a07621`
- catalog version: `catalog-2026-07-16`
- catalog content SHA-256:
  `c67ec3eb357ff74af27e00c2be8654d0baed40fab288b03239dd0948c132afca`
- reward behavior profile: `reward-v1`
- encounter behavior profile: `encounter-v5`

The manifest fixes every table's row count, column count, header, and SHA-256.
The catalog checker verifies those facts before a typed snapshot reaches a
generation stage.

## Rule-to-table map

| Rule family and formula | Checked table inputs | Owning stage | Reference evidence |
| --- | --- | --- | --- |
| Party daily XP is the sum of `count × Day_XP_Per_Character(level)`; the requested session target applies the exact day fraction at the documented integer allocation boundary. | `DB_Progression.tsv` | party/reward basis and Encounter target allocation | `session-generation-encounter-engine.test.ts`, rational boundary tests |
| Per-character Reward XP is effective Reward XP divided by active party count. Session Reward XP is the allocated session target; group Reward XP is the current campaign-policy value for the normalized living roster. Dead quantities remain provenance and contribute no XP. | `DB_Progression.tsv`; stored group XP facts | party/reward basis | Reward-budget and group-policy parity tests |
| Gold budget in copper is `roundHalfUp(perCharacterRewardXp × weighted Gold_Per_XP × 100)` with a minimum applicable budget of one copper. | `DB_Progression.tsv` | reward budget and magic targets | Reward-budget stage Golden |
| Each rarity target is `floor(perCharacterRewardXp × weighted rarity-per-XP)` plus one deterministic Bernoulli draw for the rational remainder. | `DB_Progression.tsv` rarity-per-XP columns | reward budget and magic targets | Magic-target rounding and entropy tests |
| CR labels, codes, and unit XP are canonical catalog facts; equivalent authored fraction spellings resolve through the one CR parser before selection. | `DB_CR.tsv` | Encounter roster selection/import | CR parser and Encounter selection tests |
| Allowed role ranges by party level and CR come from active role-band rows. | `DB_EncounterRoleBands.tsv`, `DB_CR.tsv` | Encounter composition | Encounter selector tests |
| Encounter patterns define ordered role combinations and block counts. | `DB_EncounterPatterns.tsv` | Encounter composition | Pattern and candidate Golden tests |
| Session treasure count, normal/overstock split, and channel allocation use the full-session profile; a group reward fixes one normal Encounter channel. | Progression-derived budget plus profile policy | treasure planning and channels | Session/group profile Goldens |
| Theme selection uses active themes and their magic/spell-color metadata. | `DB_Themes.tsv` | treasure planning and channels | Theme selection stability test |
| Non-magic candidates, value, capacity, form, class, type, utility, density, adornment, and source facts come from active item rows. | `DB_LootItems.tsv`, `DB_LootSources.tsv` | slot/role planning and non-magic selection | Candidate tolerance and role Goldens |
| Allowed item/modifier/theme/container relationships are explicit graph edges with stable sort order. | `DB_LootRelations.tsv` | non-magic selection, modifiers, packing | Relationship and fallback tests |
| Modifier compatibility, quantity range, component type, text template, and flat value are catalog facts. | `DB_LootModifiers.tsv` | non-magic selection and modifiers | Modifier eligibility tests |
| Magic roll bands, rarity, decision type, and item identity come from active magic rows. | `DB_MagicItems.tsv`, `DB_MagicDecisionTypes.tsv` | magic selection | Magic selection Golden |
| Variant choice uses the active, stably ordered options of the selected group. | `DB_MagicVariants.tsv` | magic variants | Variant entropy stability test |
| Enspelled eligibility and derived save/attack/charge facts use the matching chassis/spell-level rule; spell identity comes from the checked spell catalog. | `DB_EnspelledRules.tsv`, `DB_Spells.tsv` | magic variants | Enspelled boundary tests |
| Curse eligibility uses rarity range, weight, trigger, applicability, and attunement facts; selection is deterministic within the eligible weighted set. | `DB_MagicCurses.tsv` | magic variants and curses | Curse eligibility and entropy tests |
| Packing respects item capacity, relation eligibility, mixability, hiding, and stable packing priority. | `DB_Containers.tsv`, `DB_LootRelations.tsv`, item capacity facts | packing | Packing stage Golden |
| Aggregates sum structured item values and magic counts; hard audits compare generated ownership, packing, count, and budget facts without formatted prose. | Outputs of all prior stages | aggregation and audits | Audit-code and stage Golden tests |

## Rounding and entropy ownership

All ratios enter generation as exact `Rational` values. Each row above names
the stage that owns conversion to an integer. A later stage must not re-round a
value already converted by its owner.

Entropy keys are versioned semantic builders. Their public vocabulary is
limited to reward budget, treasure/channel, item selection, magic selection,
variant/curse selection, and packing identities. Stage code passes typed facts
to those builders and does not concatenate free labels.

## Change rule

A change to a formula, checked table meaning, rounding point, entropy stream,
or hard audit changes the applicable component engine version and its focused
reference evidence. A catalog-row change updates the manifest hashes and
catalog content hash without pretending to be an engine change. Runtime never
falls back to live spreadsheet content.

## References

- [Session Generation domain](../domain/domain-session-generation.md)
- [Session Generation requirements](../requirements/requirements-session-generation.md)
- [Refactor acceptance matrix](../../project/architecture/session-planner-generation-loot-refactor-acceptance-matrix.md)
