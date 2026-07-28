# SaltMarcher

Status: Active migration entry point
Owner: Godot Cutover Program
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the canonical files under `docs/`

SaltMarcher is a local-first tabletop-campaign desktop tool for preparing,
running, and following up on a GM's own table.

SaltMarcher is being rebuilt as a native Godot 4 project. The Godot runtime is
the only target architecture. The JavaFX/SQLite tree remains temporarily as
migration input and is removed capability by capability; it is not a second
supported product line.

The production shell now exposes `Campaigns` and one consolidated `Katalog`
route. Katalog retains all seven target sections; Monster and Items already
query the selected installation-wide Shared-Definition generation off the
scene-tree thread, while NPCs, factions, and places use the active Campaign's
World Planner partition. The shared result table sorts before bounded paging,
retains each section's page and direction, and cancels invisible provider work;
unmigrated sections report unavailable rather than inventing Catalog-owned
records. Selected NPCs, factions, and places expose attached note-first Quest
and rumour threads with explicit manual resolution and recoverable trash in the
same Inspector. A separate bounded detail read shows full typed entity state;
NPC appearance, behavior, history, lifecycle/disposition and faction
disposition are editable without widening Catalog rows. Searchable, paginated
provider pickers maintain NPC statblock/faction/last-place and place-faction
references without raw ID entry. Encounter Tables now use a separate
Campaign-owned Godot partition with bounded Catalog browsing, weighted
Creature membership, create/edit, full details, World Planner references, and
latest-wins candidate reads. Saved Encounters now use their own Campaign
partition with bounded search/detail, Creature-backed roster create/edit,
recoverable trash/restore, and restart readback. The runtime Encounter builder,
generation, and combat modes remain migration work. A compact Party top-bar dropdown now
provides the active Campaign's Roster/current-Party foundation without adding a
third navigation route. Its separate native Rastbudget trigger provides
active/custom Adventuring-Day budgets and XP timelines; travel, Planning Party
integration, and legacy deletion remain migration work.

## Quickstart

Run the Godot application from the repository root:

```bash
godot --path .
```

Run the current headless foundation tests:

```bash
godot --headless --path . --script res://godot/tests/run_all.gd
```

Install the currently committed Godot development build for local desktop
testing (the installer refuses a dirty worktree):

```bash
godot/tools/install_desktop_app.sh
```

This development install contains only the Godot project and icon and launches
through the locally installed Godot 4 executable. Self-contained Linux,
Windows, and macOS exports remain a product qualification gate.

On restricted machines, point Godot's XDG data, cache, and config directories
at writable locations before running it.

## Local Data

The Godot application stores installation state below
`user://salt-marcher/`. Campaign identity and activation are already stored as
immutable, checksummed JSON generations. Campaign truth uses immutable
owner-partition generations and can round-trip through a streaming,
checksummed `.saltmarcher` bundle under a new import identity. Reusable
definitions live installation-wide in immutable generations; Campaigns store
stable references, complete export closes over required definitions, and
conflicting imports remain staged until an explicit keep, replace, retain-both,
or discard decision. The Campaign desk exposes that complete transfer path as
a non-blocking worker with visible file/definition progress and cancellation;
its conflict ledger names affected Campaigns and shows every consequence before
publication. Repeated early, middle, and post-commit cancellation exercises the
worker's single terminal outcome and releases its thread and queue state. The
current backend also schedules restore-tested recovery points in the background,
supports retained-original restore and recoverable trash, and provides
explicitly confirmed permanent deletion. Backup retention and storage-pressure
handling now preserve a 2 GiB floor and at least three verified points. Normal
maintenance keeps all points for one hour, then one per hour, day, and week
through 26 weeks, with a configurable hard point cap. Revoked-writer
compaction removes only old commits, partition objects, asset revisions, and
binary chunks unreachable from the three retained local generations and already
covered byte-exactly by a current restore-tested point; damaged evidence defers
the operation. Assets retain stable semantic identities, original portable
filenames, media kinds, byte sizes, and checksums while updates receive fresh
immutable content paths. Spatial chunks use stable owner/coordinate identities
with the same immutable byte protocol. Complete backup and export validate the
entire referenced binary closure; a damaged optional asset remains isolated
without blocking core Campaign open. A single background maintenance worker
assesses the active Campaign
at startup, activation, and every confirmed generation. At 64 valid local
generations it fences Campaign actions, drains accepted writes, compacts back to
three local generations, restores writer authority on every terminal path, and
retries interrupted maintenance without blocking the scene-tree thread. Backup
retention and compaction share one maintenance lock over the recovery pool.
Production storage admission reads total and available volume bytes
through direct POSIX or Windows platform adapters and fails closed when the
greater-of-2-GiB-or-five-percent reserve cannot be proven. Real Windows/macOS
export qualification and representative binary scale remain migration work.
Accepted Campaign
writes run through one serial ticketed worker. Create and switch transitions
revoke new source work immediately, drain accepted work for up to ten seconds
off the UI thread, and publish the active pointer only after a successful
drain. A timeout keeps the source pointer and UI fence until that write reaches
one terminal result, then restores source authority automatically. Orderly
application shutdown waits for all accepted work rather than abandoning it.
Recovery points share unchanged Campaign bytes through content-addressed blobs;
portable `.saltmarcher` bundles remain the transfer format. No Godot code opens
SQLite or JDBC.
The complete target persistence and recovery semantics are owned by the
[Persistence Lifecycle](docs/project/contract/persistence-lifecycle.md).

Pre-completion Java SQLite data is disposable under the confirmed product
baseline and is deliberately not imported into the Godot format.

## Project Map

- `project.godot`: Godot project entry point
- `godot/src/app/`: application composition and lifecycle
- `godot/src/ui/`: reusable and shell presentation
- `godot/src/platform/`: feature-neutral Godot mechanisms
- `godot/src/capabilities/`: product capabilities as they are migrated
- `godot/tests/`: headless Godot verification
- `docs/`: canonical product, architecture, contract, and migration truth
- `app/`, `shell/`, `platform/`, `features/`: temporary Java migration source

Start with [docs/README.md](docs/README.md) for the documentation map and the
[Godot cutover roadmap](docs/project/delivery/roadmap-godot-cutover.md) for the
live migration state.
