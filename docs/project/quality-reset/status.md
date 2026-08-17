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

## Milestones

| Milestone | State | Exit proof |
| --- | --- | --- |
| M0 · trustworthy integration baseline | in progress | candidate and main remote runs pending |
| M1 · version and contract truth | in progress | local focused gates green; remote candidate pending |
| M2 · reward/loot vertical slice | pending | — |
| M3 · world planner, roster, references | pending | — |
| M4 · campaign import product path | pending | — |
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
