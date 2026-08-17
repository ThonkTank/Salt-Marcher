# Renderer bundle inventory and budgets

The bundle gate measures manifest reachability rather than individual hashed
filenames. Every graph includes its JavaScript, CSS, fonts, and other emitted
assets. Feature graphs are incremental over the common Workspace graph, so the
report states which route-specific dependency set grew.

| Graph | Limit | Calibration rationale |
| --- | ---: | --- |
| Shell entry JavaScript | 32 KiB | Existing pre-inventory limit; retained unchanged |
| Common Workspace JavaScript | 810 KiB | Architecture target after removing renderer-side contract schemas |
| Shell initial graph | 896 KiB | Current shell plus more than ten percent corrective reserve |
| Complete common Workspace graph | 1,280 KiB | Includes shell assets/fonts while retaining the old 900 KiB JavaScript gate |
| Session lazy graph | 448 KiB | Incremental Session route and shared editor primitives |
| Catalog lazy graph | 384 KiB | Incremental Catalog route including its World Location integration |
| Hex lazy graph without Pixi | 384 KiB | Controller and views; Pixi is forbidden from this static graph |
| Reference lazy graph | 128 KiB | Reference presentation leaf |
| Pixi dynamic leaf | 1,792 KiB | Pixi renderer/backend closure, reachable only by dynamic import |
| Reachable renderer | 90% of 3.20 MiB | The refactor target is a hard gate, not a warning |

`pnpm test:bundle-budget` prints exact bytes, utilization, and remaining reserve
for every graph. `BUNDLE_REPORT_GZIP=1` additionally prints per-graph gzip
comparison values; raw emitted bytes remain the enforced metric.

## Architecture-hardened editable group-reward measurement

Measured again by the complete local canonical check on 2026-08-13:

| Graph | Raw bytes | Gzip comparison | Limit use |
| --- | ---: | ---: | ---: |
| Shell initial | 400,451 | 254,724 | 43.6% |
| Complete common Workspace | 488,104 | 283,769 | 37.2% |
| Session incremental | 156,407 | 44,570 | 34.1% |
| Catalog incremental | 173,761 | 54,984 | 44.2% |
| Hex incremental without Pixi | 174,781 | 59,263 | 44.4% |
| Reference incremental | 39,392 | 14,802 | 30.1% |
| Pixi dynamic leaf | 407,032 | 118,818 | 22.2% |
| Reachable renderer | 1,435,953 | 565,164 | 47.5% of the 90% target; 42.8% of the legacy ceiling |

The hard refactor target therefore retains 1,583,945 raw bytes. The checked
baseline ratchets every measured graph down; the reachable snapshot falls by
1,545,148 bytes from 2,981,101. The reduction comes from making the already
configured production renderer minification explicit and retaining the Group
manager behind its lazy host; no dependency version changed. Feature
dictionaries are runtime-local: the type-only key assembly
imports no values, and Catalog, Hex, Session, Reference, and World Planner
runtimes each import only the shared UI/base copy plus their own dictionary.
Pixi remains reachable solely through the canvas dynamic import. The
World-Location integration also keeps inline Faction and Encounter Table
creation behind one dynamic boundary. Direct Catalog Faction editing is a
dynamic dialog leaf as well; this refactor reduced the static Catalog graph by
12,766 bytes from the recorded pre-refactor graph while preserving the shared
application port.
Burger navigation, campaign management, and the interaction-heavy Encounter
Generator settings editor are dedicated dynamic leaves. Generator CSS and
German copy follow the settings leaf, and its lightweight editor model does not
import the Zod wire contract. The 20-by-34 matrix and preset controls therefore
do not enter the common Workspace JavaScript graph until the GM opens Settings.
Common Workspace JavaScript is 277,254 bytes, below the 810 KiB gate, and no
dependency version changed for this baseline. The Planner remains its
own dynamic route; the common growth is the typed capability and German message
surface shared by Session, Planner, Encounter, Party, and Loot.

The Pixi graph is incremental over Hex and stops at Vite's HTML-entry and
common-Workspace back-edges. Without those boundaries, traversing imports from
the dynamic Pixi runtime leaves incorrectly includes unrelated sibling routes
such as Session Planner, Campaign, and generator settings. A guard rejects
those dialogs if they reappear in the Pixi measurement.

Every graph is also compared with
`renderer-bundle-baseline.json`. Growth above 16 KiB fails and prints the
largest emitted files plus an import path. Baselines may only be updated with:

```text
pnpm bundle:baseline:update -- --reason "…" --dependency "…" --chunk "…"
```

The command remeasures the production build, retains all hard route and total
ceilings, and records all three rationales. A smaller graph fails the normal
gate with a ratchet instruction and must be captured by the next reviewed
baseline update before the canonical check.
The 2026-08-12 measured snapshot explicitly records the architecture-hardened
editable Group Loot graph with the required change, dependency, and chunk
rationales. Fixed route, Workspace, and 90-percent total ceilings are unchanged.
The single GroupManager controller/reducer remains in the Session route because
it owns transient per-Group state and receives narrow capability ports; the
catalog, structured editor, and their Loot presenter/CSS stay behind dedicated
lazy boundaries.
Initial-entry, common-Workspace, route, and total limits may not be silently
relaxed as part of feature work.

## Staged local verification

- `check:fast` runs formatting, lint, type checking, unit/integration tests and
  static artifacts.
- `check:app` builds once, then runs smoke and bundle checks against that build.
- `check:e2e` builds once, runs the isolated functional Electron suites
  sequentially, then verifies each owned visual scenario independently.
- `check` is canonical and reuses the `check:app` build for both E2E stages.

E2E fixture recipes live under the versioned `tests/e2e/fixtures/v1`,
`tests/e2e/fixtures/v2`, `tests/e2e/fixtures/v3`, and
`tests/e2e/fixtures/v4` directories; every suite
copies and materializes one into a unique User Data root. Separate Group Loot
editor and atomic commit/restart suites use `v3/group-loot`, so catalog editing,
discard protection, Goldens, accessibility, commit, and restart verification no
longer depend on the multi-minute Planner/distribution journey. Every suite
writes an atomic result record and a run can resume passed suites only when the
build, registry, and selected-suite identities match. Visual Golden metadata lives in
`tests/e2e/goldens/manifest.json`. Updates require one or more explicit
`--golden <name>` arguments; unrestricted environment updates are rejected.
The v4 distribution fixture materializes a verified generated reward before
Electron starts, so distribution, restart, Ledger, and provenance remain a
focused journey instead of repeating the complete Planner-generation path.
