# SaltMarcher contributor guide

## Working checkout

- Use the current checkout for implementation, verification and handoff. Do not
  assume a machine-specific repository location.
- Preserve other contributors' dirty files and unfinished work. Return any
  task-owned results from temporary worktrees to this checkout before cleanup;
  never discard unique unfinished work.

## Product and architecture

- SaltMarcher continues the former Kampagnenwerkstatt. Start at `docs/INDEX.md`.
  For the selected task, read the relevant product/scope/architecture sections
  and acceptance IDs. Do not load the entire `acceptance.json` as background.
- Use the Electron/TypeScript/SQLite application in `desktop/` and `src/app/`.
  The historical Obsidian adapter remains a reference, not a delivery target.
- Keep renderer privileges restricted to the preload bridge. Main owns native
  capabilities and the canonical storage boundary.
- Preserve the original requirements and source bindings in
  `docs/project/requirements/sources.json`. Implemented behavior, automated evidence, native
  qualification, and owner acceptance remain separate claims.
- Atlas work follows the current user-approved cleanup and full renderer cutover
  in [Atlas architecture](docs/atlas/architecture/unified-spatial-atlas.md).
  The confirmed terrain/water execution assignment, including package ownership,
  delegation, review, timing and synchronization duties, is maintained separately
  in [terrain/water execution](docs/atlas/delivery/terrain-water-execution.md).
  The former mandatory M0–M8
  sequence and Rust/WASM requirement are superseded. Preserve the complete
  functional scope, restricted renderer privileges and delivery gates. Only test
  setups exist; old internal formats need no compatibility migration. Preserve
  other contributors' unfinished code. Do not resume paused automations.

## Capability catalog and test files

- When checking a user workflow, update its actual test-file links in the shared
  `codex-dungeon-capability` catalog and record the check with `--geprueft`.
  Attach newly created test files with `--ablauf "…" --tests tests/example.test.mjs`;
  carry links through renames and explicitly remove obsolete links with
  `--entferne-tests`. Use repository-relative source paths, not build outputs.
- Map files from their test content, not just their names. A file may support
  several workflows; neither a passing suite nor a link proves complete coverage.
  Unmapped tests remain open for review and are not automatically redundant.
  `--testuebersicht --repo PATH` shows the inverse mapping without another ledger.

## Delivery

- `origin` is `ThonkTank/Salt-Marcher`; the shared integration branch is `main`.
  Preserve other contributors' dirty working copies and unfinished work.
- GitHub requires linear `main` history and the real
  `Candidate · exact-SHA aggregate` CI result. Base integration candidates on
  current `origin/main`. Transfer only your own finished changes from historical
  Dungeon or merge-based migration branches onto a fresh branch; preserve the
  old branch and dirty copy. Do not merge those historical bases into `main`.
- Use Node.js 22 and npm. Before integration the required exact-SHA Candidate
  CI must pass `npm run check:repo`, `npm run check`, `npm run check:desktop`,
  `npm test`, `npm run build`, and `npm run build:desktop`.
- Locally run the tests and type/build checks for affected entry points, plus
  relevant native UI checks. Prepare shared test assets once with
  `node build.mjs --test` before targeted Node test invocations in a fresh copy.
  Use a complete local `npm test` run to diagnose
  full-suite or host-specific problems; the mandatory CI owns full-repository
  qualification, so routine patches need no second identical full-suite gate.
- Build Linux packages with `npm run package:desktop -- <output-directory>`.
  Test native changes with the relevant existing desktop UI checks. Report
  packaging, installation, native checks, and product acceptance literally.
- Retain the `CampaignWorkbench` data directory and existing archive format
  identifiers. Do not open old SaltMarcher databases as workbench databases.
  See `docs/project/delivery/workbench-migration.md` for the cutover record.

## Mandatory agent release cadence

- After every integration, check GitHub. After **10 PRs merged into `main`**
  since the last published stable release of the `saltmarcher-workbench` product
  line, agents must automatically deliver and publish the next release. All
  merged PRs count, including backend, refactoring, tests and documentation;
  no functional-change condition applies.
- An explicit manual release request takes priority and may release before PR 10.
  Every successful publication, automatic or manual, resets the baseline to its
  source tag. Count distinct PRs whose merge commits are in `main` after that tag,
  not commits, PR-number differences or publication dates. Already integrated
  changes absent from that package still count. Old-app releases do not count.
- The agent reaching or finding the threshold owns delivery: version bump through
  Candidate CI, exact green main commit, matching `vVERSION` tag, successful
  signed package/native restart workflow, and verified published release. This
  standing instruction authorizes publication without another permission question.
  Report the baseline tag, PR count and release link, or a concrete blocker.
- Check release PRs, tags, drafts and workflows first; continue an existing release
  instead of duplicating it. A manual request supersedes a pending automatic
  release rather than adding another. Failed builds and drafts do not reset the
  count; never bypass checks or overwrite a published version.
  Details: [GitHub releases](docs/project/delivery/github-updates.md#verbindlicher-release-rhythmus-für-agenten).
