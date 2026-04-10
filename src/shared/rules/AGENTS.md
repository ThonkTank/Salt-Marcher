# Shared Rules

## Purpose

`src/shared/rules` owns cross-feature DnD reference values and rule calculations that multiple
features consume without any single feature owning the vocabulary.

## Canonical Types and APIs

- `shared.rules.model.ChallengeRating` - canonical shared CR value type for DB round-trip display plus parsed numeric value.
- `shared.rules.model.EncounterDifficulty` - canonical shared encounter difficulty vocabulary.
- `shared.rules.model.EncounterDifficultyStats` - passive encounter threshold snapshot for builder and combat UI.
- `shared.rules.model.AdventuringDayBudget` - passive adventuring-day XP budget snapshot.
- `shared.rules.model.LootCoins` - passive physical coin representation with denomination-sensitive equality.
- `shared.rules.service.XpCalculator` - shared XP thresholds, CR-to-XP lookups, and encounter/adventuring-day rule calculations.
- `shared.rules.service.LootCalculator` - shared loot settlement rules.

## Where New Code Goes

- Put cross-feature DnD rule value types in `model/`.
- Put reusable rule calculations or lookups in `service/`.
- Keep feature-owned encounter, party, or creature workflows in their owning feature even when they consume these rules.

## Forbidden Drift

- Do not leave cross-feature rule vocabulary under `features.creatures` or other feature-owned model packages.
- Do not move feature workflows or persistence into `shared.rules`.
- Do not reintroduce model carriers as nested helper types inside calculator classes once they are canonical shared model.
