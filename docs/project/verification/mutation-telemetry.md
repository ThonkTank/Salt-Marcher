Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Advisory mutation telemetry for behavior-harness strength.

# Mutation Telemetry

`mutationHarnessReport` runs PIT mutation telemetry per existing
`tools/quality/config/harness-map.json` area. It uses `DEFAULTS` mutators,
`timeoutFactor=2`, available processor threads, target classes derived from the
area production package roots. The task generates temporary JUnit 5 adapter
tests for the mapped behavior-harness main classes so PIT can execute JavaExec
harnesses without changing the harness implementations. Reports are advisory
and written under `build/reports/pitest-areas/`.

`tools/looper-system/scripts/mutation_gap_sync.py` reads those summaries and updates
`docs/project/verification/harness-gaps.md` only for areas with at least one
mutation and a mutation score below 50%, or for areas whose PIT run exceeds the
per-area timeout. The generated low-score row format is:

```text
| <area> | Harness exists, mutation score N% | P2 | Strengthen assertions until mutation score >= 50%. |
```

Scores at or above 50% remove previously generated rows of that shape. Mutation
telemetry never blocks a merge; it creates or refreshes harness-strength work
items. Timeout rows ask for splitting or strengthening the harness until monthly
telemetry completes under the per-area timeout.
