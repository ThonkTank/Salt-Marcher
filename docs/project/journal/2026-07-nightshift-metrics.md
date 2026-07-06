Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-06
Source of Truth: R1 queue note for autonomous-operation metrics reporting.

# Nightshift Metrics Journal

## 2026-07-06 nightshift-metrics-aggregator - Add autonomous run metrics

Problem: queue task `30-metrics-aggregator` needs a local Markdown metric
surface for the last 14 days of autonomous operation.
Target state: `tools/quality/scripts/nightshift_metrics.py` reads live GitHub
data through `gh api`, prints merges per day, red required-check share,
judge failures, reverts, and open acceptance age, and degrades to
`Metriken heute unvollstaendig` on GitHub API limits or read failures.
Status report use: the metrics section can be pasted into the German status
report or called by a future R3c change to the frozen status updater; this R1
slice does not edit `tools/quality/scripts/update_status_issue.py`.
