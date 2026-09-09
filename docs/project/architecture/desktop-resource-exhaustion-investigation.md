# Desktop resource exhaustion investigation — 2026-09-09

## Scope

This investigation is separate from action-scoped draft coordination. It uses
the previous boot's journal and current host limits; no operating-system limits
or application behavior were changed.

## Established sequence

- At 11:34:37 CEST, a Flatpak Steam installation completed.
- In the same second, the user-session `dbus-broker-launch` process failed in
  `dirwatch_new` with `Too many open files` while reloading its configuration.
- The user D-Bus broker then exited. ChatGPT and SaltMarcher Local aborted after
  Chromium reported that their D-Bus connections had been disconnected.
- WirePlumber lost the same bus connection and subsequently crashed; the wider
  desktop session became unstable.

SaltMarcher was therefore a downstream victim of the user-bus failure. The
journal contains no SaltMarcher resource-exhaustion error before the D-Bus
disconnect, so the evidence does not connect the draft-coordination work to the
trigger.

## Exhausted resource and remaining attribution gap

The failed operation was creation of a directory watcher. On this host,
`fs.inotify.max_user_instances` is 128. Linux may report `EMFILE` (`Too many open
files`) for either a process file-descriptor limit or exhaustion of the per-user
inotify-instance limit. The D-Bus service's descriptor limit is 524288, while no
other `Too many open files` event appears in the relevant journal interval. This
makes the shared inotify-instance pool the stronger explanation, but the
historical count was not captured and the journal cannot prove it conclusively.

The evidence identifies `dbus-broker-launch` as the process whose watcher
creation failed. It does not identify which process or set of processes consumed
the preceding inotify instances. A ChatGPT coredump contains an active native
inotify watcher thread, but that establishes use only, not excessive ownership.

## Decision

Do not raise limits or change SaltMarcher from this evidence. A conclusive
attribution requires a live per-process snapshot of inotify instances and watch
counts before exhaustion, ideally captured periodically with process identity
and start time. Draft coordination remains unchanged by this investigation.
