# Quality reset status

This record executes the staged quality reset from the authoritative handoff
package against remote baseline
`c25c20a9ab574ee64c193d82db05c7fab7ae0f8c` (2026-08-17). The executable
traceability record is [requirements-ledger.yaml](requirements-ledger.yaml).

## Baseline audit

- `origin/main`, not the stale local `main`, resolved to the package baseline.
- The starting checkout was clean. Work continues on
  `quality-reset/handoff-20260817`, created directly from `origin/main`.
- `ef5b46f8f`, `9f4d332d8`, and `c25c20a9a` are ancestors of the baseline.
- GitHub Actions run `32025283882` is the live failing baseline.
- Windows and macOS ran Linux-only profile/AppImage semantics. Their first
  failure is `/proc` process identity in the profile lock. The affected local
  installation and profile-lock code entered in `d8224d088`.
- Linux E2E captured `group-management` while the creature workspace was still
  selected. The checked-in Golden shows the completed Loot draft, so the
  baseline image is retained and the renderer/test readiness contract is fixed.
- Candidate run `32036271035` proved all five sharded Linux E2E jobs and the
  Linux runtime/AppImage job green. It also isolated two portable build defects:
  Ubuntu smoke needed an Xvfb wrapper, while Windows could not spawn the
  extensionless `corepack` shim from Node. Both are now regression-covered.
- Candidate run `32037719930` then proved Ubuntu, Windows, macOS, Linux
  runtime, and four of five E2E shards green. Its retained failed-shard
  artifact identified an expected Reward-v3 Golden change and an asynchronous
  Travel Resume/Stop race; the race now waits for persisted travelling state.

## Milestones

| Milestone | State | Exit proof |
| --- | --- | --- |
| M0 · trustworthy integration baseline | in progress | candidate and main remote runs pending |
| M1 · version and contract truth | in progress | local focused gates green; remote candidate pending |
| M2 · reward/loot vertical slice | verified | `3b9e70e73` + `242caff74`; `check:loot-parity` and architecture gates green |
| M3 · world planner, roster, references | verified | `38ef442f6` + `5c9971432`; `check:world-planner`, architecture and integration gates green |
| M4 · campaign import product path | verified | `2dd82e654`; `check:campaign-import`, architecture, portable unit and integration gates green |
| M5 · session UI and layout | pending | — |
| M6 · focused verification and handoff | pending | — |

## M0 decisions

- Portable checks run on Ubuntu, Windows, and macOS. `/proc`, profile-lock,
  AppImage, packaged installation, and installed-runtime prerequisites are an
  explicit Linux partition.
- Linux E2E is sharded by the stable suite registry. Every suite owns a copied
  fixture and every failed suite retains its log, atomic summary, screenshots,
  diffs, and materialized state.
- Visual assertions wait for renderer-owned domain readiness and two settled
  animation frames. Golden Masters are not timing synchronization primitives.
- Delivery is candidate-first. Remote checks prove the immutable SHA before the
  single local handoff and exact-SHA promotion to `origin/main`.

## M2 decisions

- Reward v3 receives raw member snapshots and derives the aggregate party,
  projected XP, cumulative deficits and stale comparison centrally.
- Session and group rewards share one typed proposal pipeline, issue contract,
  catalog index, seedable RNG boundary and packing policy.
- Money remains rational through interpolation and price-times-quantity, with
  half-up rounding only at the documented integer boundary.
- Schema-30 Loot receipts are retained as a version-named archive instead of
  being silently deleted; they are evidence, not replay authority.
- `check:loot-parity` is the fast owner gate. Fast-check counterexamples retain
  their seed, and E2E resume receipts retain every attempt log.

## M3 decisions

- World Planner owns NPC-faction membership through a required mutation port;
  Encounter sources no longer expose or forward NPC CRUD.
- Schema 33 enforces NPC location and faction membership references. NPC lists
  are server-filtered, capped at 100 rows, and keep long prose in on-demand
  detail projections.
- NPC command receipts retain the newest 1,000 identities and contain only the
  outcome entity/deletion plus resulting NPC and faction revisions.
- Reference change descriptors and a reverse dependency index replace global
  before/after document serialization. Runtime NPC, faction, and location
  events refresh resolved labels; Creature references are immutable per build.
- Production Party rosters start empty. Example members are an explicit
  dev/test seed, Party languages load in constant query count, and XP/rest/
  travel/adventuring-day rules are independently unit tested.

## M4 decisions

- Campaign import is a Utility-owned product capability with strict V1 bundle,
  previewable conflicts, staged apply, complete domain readback, and
  `quick_check` before activation.
- Schema 34 stores source revision/hash/sections/resolutions and external-key
  mappings; the installation registry keeps one campaign identity per source.
- Identical reapply is a no-op. Delta preview compares entity content hashes
  and reports only changed source sections; a changed image replaces the prior
  campaign only after staged verification succeeds.
- The revision-6098 Tower-of-Time fixture and semantic Golden preserve Hank's
  PP 11/languages and every language, species, statblock, faction, and location
  decision. Maintenance callers are deployment-SHA guarded before profile
  access; normal import runs through the installed Utility process.
