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

- `~/.local/bin/saltmarcher-autodev.sh`
- `~/.local/share/saltmarcher-autodev/task-prompt.md`
- `~/.config/systemd/user/saltmarcher-autodev.service`

Control commands:

```bash
systemctl --user status saltmarcher-autodev.service --no-pager
systemctl --user restart saltmarcher-autodev.service
systemctl --user disable --now saltmarcher-autodev.service
```

The operating contract remains
`docs/project/architecture/night-shift.md`.
