# SaltMarcher contributor guide

## Product and architecture

- SaltMarcher continues the former Kampagnenwerkstatt. Read `docs/PRODUCT.md`,
  `docs/SCOPE.md`, `docs/INDEX.md`, `ARCHITECTURE.md`, and `acceptance.json`.
- Use the Electron/TypeScript/SQLite application in `desktop/` and `src/app/`.
  The historical Obsidian adapter remains a reference, not a delivery target.
- Keep renderer privileges restricted to the preload bridge. Main owns native
  capabilities and the canonical storage boundary.
- Preserve the original requirements and source bindings in
  `docs/scope-sources.json`. Implemented behavior, automated evidence, native
  qualification, and owner acceptance remain separate claims.

## Delivery

- `origin` is `ThonkTank/Salt-Marcher`; the shared integration branch is `main`.
  Preserve other contributors' dirty working copies and unfinished work.
- GitHub requires linear `main` history and the real
  `Candidate · exact-SHA aggregate` CI result. Base integration candidates on
  current `origin/main`. Transfer only your own finished changes from historical
  Dungeon or merge-based migration branches onto a fresh branch; preserve the
  old branch and dirty copy. Do not merge those historical bases into `main`.
- Use Node.js 22 and npm. Before integration run `npm run check:repo`,
  `npm run check`, `npm run check:desktop`, `npm test`, `npm run build`, and
  `npm run build:desktop`. Candidate CI must pass on the exact published SHA.
- Build Linux packages with `npm run package:desktop -- <output-directory>`.
  Test native changes with the relevant existing desktop UI checks. Report
  packaging, installation, native checks, and product acceptance literally.
- Retain the `CampaignWorkbench` data directory and existing archive format
  identifiers. Do not open old SaltMarcher databases as workbench databases.
  See `docs/project/delivery/workbench-migration.md` for the cutover record.
