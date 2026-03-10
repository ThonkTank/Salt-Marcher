# Shared Module Rules

`src/shared` is for cross-feature, framework-neutral utilities that are reused in two or more features/importers.

## Allowed
- Generic helpers with no feature-specific domain ownership.
- Stable utility code that can be called from multiple features/import pipelines.
- Small shared submodules with clear, narrow purpose (for example `shared/crawler/*`).
- Shared domain policy and infrastructure reused across features, as long as it depends only on shared-owned types.
- Parser helpers reused by both importer and UI/application code (for example `shared/creatures/parser/*`).

## Not allowed
- Feature domain models, repositories, or services that belong under `src/features/<feature>/...`.
- UI classes (`View`, `Pane`, `Dialog`, `Controls`, JavaFX wiring).
- Catch-all dumping (`common`, `misc`, unrelated utility mixes).

## Placement rule
- If code has a clear feature owner, keep it in that feature.
- Move code to `src/shared` only when multiple features/importers need the same behavior, no single feature should own it, and it does not depend back on feature packages.
