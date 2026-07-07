Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Local operator commands for repo-owned SaltMarcher tooling.

# Local SaltMarcher Tools

## Autonomous Runner

The continuous autonomous runner is repo-owned here so every device can install
the same script, prompt, and user-systemd unit.

Install or refresh the local runner:

```bash
tools/local/install-autodev-runner.sh
```

Installed paths:

- `.codex/autodev/runner/repo/`
- `.codex/autodev/runner/queue/`
- `.codex/autodev/runner/telemetry/`
- `.codex/autodev/runner/logs/`
- `.codex/autodev/runner/reports/`
- `.codex/autodev/runner/systemd/saltmarcher-autodev.service`

The installer removes legacy runner files from `~/.local/bin`,
`~/.local/share/saltmarcher-autodev`, and
`~/.local/state/saltmarcher/autodev`. The only user-systemd integration is the
linked service registration; the executable script, prompt, working clone,
queue, telemetry, reports, logs, and sentinels all live under this checkout.

Control commands:

```bash
systemctl --user status saltmarcher-autodev.service --no-pager
systemctl --user restart saltmarcher-autodev.service
systemctl --user disable --now saltmarcher-autodev.service
touch .codex/autodev/runner/STOP
rm .codex/autodev/runner/STOP
```

The operating contract remains
`docs/project/architecture/night-shift.md`.
