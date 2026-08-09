# Renderer bundle inventory and budgets

The bundle gate measures manifest reachability rather than individual hashed
filenames. Every graph includes its JavaScript, CSS, fonts, and other emitted
assets. Feature graphs are incremental over the common Workspace graph, so the
report states which route-specific dependency set grew.

| Graph | Limit | Calibration rationale |
| --- | ---: | --- |
| Shell entry JavaScript | 32 KiB | Existing pre-inventory limit; retained unchanged |
| Common Workspace JavaScript | 900 KiB | Existing pre-inventory limit; retained unchanged |
| Shell initial graph | 896 KiB | Current shell plus more than ten percent corrective reserve |
| Complete common Workspace graph | 1,280 KiB | Includes shell assets/fonts while retaining the old 900 KiB JavaScript gate |
| Session lazy graph | 448 KiB | Incremental Session route and shared editor primitives |
| Catalog lazy graph | 384 KiB | Incremental Catalog route including its World Location integration |
| Hex lazy graph without Pixi | 384 KiB | Controller and views; Pixi is forbidden from this static graph |
| Reference lazy graph | 128 KiB | Reference presentation leaf |
| Pixi dynamic leaf | 1,792 KiB | Pixi renderer/backend closure, reachable only by dynamic import |
| Reachable renderer | 3.20 MiB hard; 90% warning | Crossing 90% is visible but only the absolute ceiling is a hard failure |

`pnpm test:bundle-budget` prints exact bytes, utilization, and remaining reserve
for every graph. `BUNDLE_REPORT_GZIP=1` additionally prints per-graph gzip
comparison values; raw emitted bytes remain the enforced metric.

## Schema-22 Generator architecture baseline

Measured from the production build on 2026-08-09:

| Graph | Raw bytes | Gzip comparison | Limit use |
| --- | ---: | ---: | ---: |
| Shell initial | 773,252 | 294,302 | 84.3% |
| Complete common Workspace | 1,045,738 | 350,377 | 79.8% |
| Session incremental | 347,070 | 67,536 | 75.7% |
| Catalog incremental | 365,410 | 77,940 | 92.9% |
| Hex incremental without Pixi | 353,671 | 80,442 | 89.9% |
| Reference incremental | 97,770 | 22,594 | 74.6% |
| Pixi dynamic leaf | 1,257,760 | 271,483 | 68.5% |
| Reachable renderer | 3,104,656 | 789,251 | 92.5% of hard ceiling |

The hard ceiling therefore retains 250,787 raw bytes. The 90-percent warning is
active and intentionally visible in `check:app`; it is not a second hard
ceiling. Feature dictionaries are runtime-local: the type-only key assembly
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
Common Workspace JavaScript is 829,068 bytes, below the refactor target of 810
KiB, and no dependency version changed for this baseline.

The Pixi graph is incremental over Hex and stops at Vite's HTML-entry
back-edge. Without that boundary, traversing the entry from the dynamic Pixi
leaf incorrectly included unrelated sibling routes such as Campaign and
generator settings. A guard rejects those dialogs if they reappear in the Pixi
measurement.

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
Initial-entry, common-Workspace, route, and total limits may not be silently
relaxed as part of feature work.

## Staged local verification

- `check:fast` runs formatting, lint, type checking, unit/integration tests and
  static artifacts.
- `check:app` builds once, then runs smoke and bundle checks against that build.
- `check:e2e` builds once and runs isolated Electron suites with at most two
  suite processes.
- `check` is canonical and reuses the `check:app` build for its E2E stage.

E2E fixture recipes live under `tests/e2e/fixtures/v1`; every suite copies and
materializes one into a unique User Data root. Visual Golden metadata lives in
`tests/e2e/goldens/manifest.json`. Updates require one or more explicit
`--golden <name>` arguments; unrestricted environment updates are rejected.
