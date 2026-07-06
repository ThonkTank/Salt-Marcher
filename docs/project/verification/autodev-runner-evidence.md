Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Evidence inventory for the repo-owned continuous autonomous runner.

# Autodev Runner Evidence

## Purpose

This inventory records retained proof that the local continuous autonomous
runner is reproducible from the repository and follows the current
`docs/project/architecture/night-shift.md` contract.

## Verified Sources

- `docs/project/architecture/night-shift.md`
- `tools/local/saltmarcher-autodev.sh`
- `tools/local/saltmarcher-autodev-task-prompt.md`
- `tools/local/install-autodev-runner.sh`
- `tools/local/systemd/saltmarcher-autodev.service`

## Evidence 2026-07-07

- Syntax: `bash -n tools/local/saltmarcher-autodev.sh` and
  `bash -n tools/local/install-autodev-runner.sh` exited `0`.
- Dry-run: `AUTODEV_DRY_RUN=1 ... bash tools/local/saltmarcher-autodev.sh`
  exited `0` and emitted telemetry result `dry_run_ok`.
- Legacy compatibility: `retire_legacy_idle_result` converted
  `result=no_work` to `result=blocked` with blocker
  `Runner emitted retired no_work result; scout contract repair required`.
- Queue completion: `maybe_archive_queue_task` archived a queue item only after
  the matching `.done` file existed and telemetry used `result=queue_done`.
- Documentation: `./gradlew checkDocumentationEnforcement --console=plain`
  completed with `BUILD SUCCESSFUL`.
- Installed parity: `cmp -s` returned `0` for repo versus installed runner,
  task prompt, and user-systemd unit.
- Live service: `tools/local/install-autodev-runner.sh` installed from the repo
  and restarted `saltmarcher-autodev.service`; `systemctl --user status`
  reported the service `active (running)`.
- Live runner behavior: after the repo install, session `52` ran with
  `AUTODEV_QUOTA_MODE=merge_pressure,r1_pressure`, selected existing green PR
  `#350`, enabled auto-merge, observed all required checks passing, and then
  entered the normal `600` second session pause.

## Proof Boundary

This evidence qualifies the local runner packaging, prompt contract, legacy
result normalization, installed-file parity, and current service activation on
this machine. It does not prove that every future scout will find the best
possible refactor target; that remains review-owned through the PR and telemetry
evidence each runner session emits.
