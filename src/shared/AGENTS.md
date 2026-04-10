# Shared Module Rules

## Purpose

`src/shared` owns cross-feature, framework-neutral utilities reused by two or more features or importers.

## Canonical Types and APIs

- `shared/crawler/config/ConfigObject` — shared runtime config seam for crawler properties, session validation, delay parsing, and project-local path resolution.
- `shared/crawler/http/HttpObject` — shared raw crawler HTTP seam for client construction, throttling, retry, and authenticated fetches.
- `shared/crawler/slug/SlugObject` — shared slug discovery seam for paginated listing scans and slug-file loading.
- `shared/crawler/slug/SlugIdentity` — shared slug deduplication and identity helpers.
- `shared/crawler/text/TextObject` — shared text normalization seam for crawler/parser whitespace cleanup and blank handling.
- `shared/crawler/text/CaseText` — shared case-formatting helper for crawler/parser vocabulary cleanup.
- `shared/creatures/parser/*` — parser helpers reused by importer and creature UI or application code.

## Where New Code Goes

- Put code here only when multiple features or importers need the same behavior, no single feature should own it, and the code depends only on shared-owned types.

## Forbidden Drift

- Do not move feature-owned domain models, repositories, or workflows here.
- Do not put UI classes here.
- Do not use `src/shared` as a catch-all dumping area.
