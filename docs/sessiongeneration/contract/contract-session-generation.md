Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session-generation API, compatibility, and persistence semantics.

# Session Generation Boundary Contract

## API

`SessionGenerationApplicationService.generate(GenerationRequest)` returns a
complete immutable `GenerationResult`; `load(generationId)` resolves a result
from the local SQLite store across restarts. Consumers MUST treat result
collections as ordered. New results use stored payload version `2`; readers
MUST continue to accept version `1`, whose Loot lines have no structured Magic
metadata. An existing generation ID cannot be overwritten, and an unsupported
payload version fails explicitly instead of being guessed or silently
regenerated.

Each version-2 Loot line carries optional `baseLootItemId`, `magicSource`, and
`curseId`. `magicSource` is empty for non-Magic Loot and otherwise `curated` or
`enspelled`. A resolved Enspelled line MUST retain its concrete base Loot item
ID; a cursed line MUST retain its selected Curse ID.

Required request fields are player levels, fraction, seed, ruleset, and locale.
Encounter count is optional and otherwise derived by `sheet-v1`. Levels outside
1..20, negative counts, negative fraction or seed, count outside 1..10, and an
unsupported ruleset are rejected before generation.

## Cross-Feature Import

Encounter accepts a generation ID, seed, ordered drafts, and ordered CR/role
blocks. It resolves only exact-XP candidates, prefers its own matching role,
falls back to any exact-XP creature, and returns all unresolved slots without
writing the Session. The key `sheet-v1 run:{id} encounter:{index}` makes retries
return the same saved Encounter plan.

Session Planner stores the resulting Encounter plan ID and generated Loot
reference `(generationId, treasureId)`. The persisted label is only a last-known
display cache and MUST NOT be interpreted as Loot-domain truth.

## Compatibility And Errors

- Ruleset changes require a new version; `sheet-v1` is never silently changed.
- Unknown imported enum-like values use the documented compatibility fallback.
- Reference tables with missing files or unexpected row counts fail loading.
- Missing generation IDs return no result; malformed or unsupported persisted
  payloads fail loading and leave the stored bytes unchanged.
- Generation warnings remain structured; hard audit failure disables Apply.
- Encounter import failure leaves the Session unchanged. A later retry may reuse
  already valid generated Encounter plans.

## Reference Data

Normalized TSV files preserve DB order. `manifest.json` owns source URL, source
SHA-256, table row/column counts, and per-file hashes. The source workbook is a
maintenance input, not a runtime dependency.

## Verification

JUnit proves import counts, Golden Master, determinism, replacement invariants,
and existing Session Planner behavior. `./gradlew check` is merge-blocking.

## References

- `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
