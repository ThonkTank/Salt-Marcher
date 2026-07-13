Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: R2 issues discovered during harness modernization and left
unchanged for normal product or verification follow-up.

# July 2026 Harness Modernization R2 Issues

## 2026-07-12 de-stair-001-preview-latency-flake

Problem: after the Dungeon Editor behavior harness fleet was converted from
JavaExec to JUnit and the stale `outputs.upToDateWhen { false }` predicate was
removed, one focused aggregate rerun exposed the existing `DE-STAIR-001`
preview-latency assertion above budget: straight stair start preview measured
283 ms against the 250 ms budget.

Evidence:
`build/gradle-run-logs/20260712T140646580898151-pid1569105-dungeonEditorBehaviorHarness.log`
failed in `DUNGEON_EDITOR_BEHAVIOR_001`; the JUnit XML failure message was
`DE-STAIR-001 straight stair start preview stays within latency budget: 283ms`.
An immediate repeat of the same focused task passed:
`build/gradle-run-logs/20260712T141010401983124-pid1572658-dungeonEditorBehaviorHarness.log`,
`BUILD SUCCESSFUL in 2m 12s`, `13 actionable tasks: 1 executed, 12 up-to-date`.

Disposition: preserve the existing assertion and production behavior during
the conversion pass. The failed run is not counted as proof; forced and full
`--rerun-tasks` proof must remain green before the batch can close. Any latency
budget repair belongs to a separate R2 follow-up.
