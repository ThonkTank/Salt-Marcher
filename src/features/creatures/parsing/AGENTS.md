# Creature Parsing

## Purpose

`features.creatures.parsing` owns canonical HTML/stat-block extraction and parsing for creature detail pages.

## Canonical Types and APIs

- `ParsingObject` - `ParseDocumentInput` or `ExtractStatBlockInput` - parses persisted monster HTML into `Creature` or extracts the stat-block fragment from a crawled detail page.

## Where New Code Goes

- Put creature-detail HTML extraction and creature-model parsing here.
- Keep tiny parser helpers in `shared/creatures/parser` only when they are truly reused outside creature parsing.

## Forbidden Drift

- Do not recreate monster stat-block parsing in `src/importer`.
- Do not move item or spell parsing here.
