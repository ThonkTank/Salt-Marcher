# CI efficiency and invariant mapping

## Baseline

The pre-follow-up `Check` workflow rebuilt application output ten times for one
candidate SHA:

| Path | Builds before | Reason |
| --- | ---: | --- |
| Portable matrix | 3 | `check:portable` built on Linux, Windows, and macOS |
| Linux package/runtime | 2 | development and qualification package paths rebuilt independently |
| Functional E2E shards | 4 | every shard ran `pnpm build` |
| Passive-window E2E | 1 | the script rebuilt before starting WebdriverIO |
| Total | 10 | queue time excluded |

The executable topology after M6 performs four builds: one Windows-native app
build, one macOS-native app build, one reusable Linux application build, and
one deliberately separate qualification-harness build. The Linux application
build is hash-validated from `out/build-receipt.json` by package, functional
E2E, visual, and passive-window consumers. That is a 60% reduction in build
executions; redundant Linux application builds fall from seven to one (86%).
Remote job durations and cache outcomes are copied into final evidence after
the first candidate run, so the compute-time claim is based on observed job
timestamps rather than queue time.

## Preserved invariants

| Invariant | Candidate job |
| --- | --- |
| Formatting, lint, both TypeScript graphs, unit/integration, reference/catalog/version truth | `Portable · static and app` |
| Windows SQLite handles, replacement/import recovery, generated runs and NPC persistence, native smoke | `Native · windows-2022` |
| macOS SQLite persistence and native smoke | `Native · macos-latest` |
| Linux profile guards, build receipt, smoke and bundle budget | `Linux build · reusable app` |
| Development AppImage packaging and execution | `Linux package · profile and AppImage` |
| Isolated functional journeys and failure evidence | four `Linux E2E` shards |
| Pixel baselines, separate from functional mode | `Linux Visual · goldens` |
| Passive-window process isolation | `Linux E2E · passive window` |
| Separate qualification renderer packaging | `Linux qualification · packaged harness` |

Native dependency and Electron caches include OS, architecture, Node major,
pnpm major, and the lockfile hash. Missing, skipped, duplicated, or failed jobs
in this mapping remain promotion-blocking through the versioned required-job
manifest.

On `main`, the expensive candidate jobs are skipped. The post-promotion job
checks the pushed ref and clean application fingerprint, then retrieves a
successful exact-SHA candidate run and validates its complete required-job set.
