# Shared Module Rules

## Purpose

`src/shared` owns cross-feature, framework-neutral utilities reused by two or more features or importers.

## Canonical Types and APIs

- `shared/crawler/config/ConfigObject` — shared runtime config seam for crawler properties, session validation, delay parsing, and project-local path resolution.
- `shared/crawler/http/HttpObject` — shared raw crawler HTTP seam for client construction, throttling, retry, and authenticated fetches.
- `shared/crawler/slug/*` — shared crawler slug utilities.
- `shared/crawler/text/*` — shared crawler text helpers.
- `shared/creatures/parser/*` — parser helpers reused by importer and creature UI or application code.

## Where New Code Goes

- Put code here only when multiple features or importers need the same behavior, no single feature should own it, and the code depends only on shared-owned types.

## Forbidden Drift

- Do not move feature-owned domain models, repositories, or workflows here.
- Do not put UI classes here.
- Do not use `src/shared` as a catch-all dumping area.
