Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Local operator commands for repo-owned SaltMarcher tooling.

# Local SaltMarcher Tools

## Desktop Updater

The active local tool bundle owns desktop updater and status commands only.
There is no active in-repo autonomous development runner.

Install or refresh the local updater:

```bash
tools/local/install-updater.sh
```

Installed paths:

- `~/.local/bin/saltmarcher-update.sh`
- `~/.local/bin/saltmarcher-next.sh`
- `~/.local/bin/saltmarcher-status.sh`
- `~/.config/systemd/user/saltmarcher-update.service`
- `~/.config/systemd/user/saltmarcher-update.timer`

Control commands:

```bash
systemctl --user status saltmarcher-update.timer --no-pager
systemctl --user restart saltmarcher-update.timer
systemctl --user disable --now saltmarcher-update.timer
```
