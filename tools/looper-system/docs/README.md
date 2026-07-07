Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Operator entrypoint for the portable Looper System bundle.

# Looper System Bundle

The Looper System lives entirely under `tools/looper-system/` except for the
user-systemd registration symlink. Install or refresh it with:

```bash
tools/looper-system/bin/install.sh
```

Useful operator commands:

```bash
systemctl --user status saltmarcher-looper.service --no-pager
systemctl --user restart saltmarcher-looper.service
systemctl --user disable --now saltmarcher-looper.service
touch tools/looper-system/state/STOP
rm tools/looper-system/state/STOP
```

The runtime state, process lab, reports, logs, queue, rendered systemd unit,
and archived legacy evidence stay under `tools/looper-system/state/`.
