Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: User-facing behavior and acceptance criteria for the encounter
feature.

# Encounter Feature Spec

## Goal

Provide a runtime encounter builder that:

- uses the active party as the balancing baseline
- generates several encounter alternatives for one requested difficulty band
- explains why an alternative fits the target
- supports iterative rerolling through lock and exclude controls
- can use selected encounter tables as curated generator sources

## Non-Goals

- authored encounter persistence
- room-aware dungeon population
- feature-specific bootstrap wiring

## Primary User Flow

1. The user opens the encounter state tab when the active
   left-bar tab is not claiming the state pane.
2. The state tab reads the active party and current creature
   filter options.
3. The user selects a difficulty and optional type, subtype, biome filters, or
   encounter tables.
4. The user generates encounter alternatives.
5. The user inspects a selected alternative, then rerolls, locks, or excludes
   as needed.

## Expected Capabilities

- show active-party thresholds for easy, medium, hard, and deadly encounters
- show daily-budget context from the party feature
- generate multiple ranked alternatives instead of one opaque result
- expose a runtime budget load path so the state UI can show thresholds before
  generation
- support multi-select creature filters with visible active-filter chips
- support generator tuning for creature amount, XP-spread balance, and
  statblock diversity
- support encounter-table selection as an alternate generator source
- show a non-blocking `Loot-Konflikt` warning when selected encounter tables
  reference multiple linked loot-table IDs
- expose creature composition, role hints, and generator highlights
- allow catalog creature rows to be added directly to the current encounter
  roster as runtime derived state
- let the user lock the current composition and reroll around it
- let the user exclude the current composition and reroll away from it
- let the user clear active lock and exclusion constraints without restarting
  the shell

## Acceptance Criteria

- the encounter feature depends only on public party and creature APIs
- generated encounters remain derived runtime output, not write-model state
- a party with no active members yields a clear empty-state message
- generator output includes adjusted XP and a difficulty-band label
- lock and exclude actions change subsequent rerolls without requiring shell
  restarts
- excluding the current composition immediately regenerates alternatives using
  the current filter and difficulty selections
- selecting encounter tables limits generated candidates to those tables and
  ignores type, subtype, and biome filters for that generation run
