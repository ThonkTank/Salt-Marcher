# SaltMarcher

SaltMarcher is a local-first tabletop-campaign tool for map travel, dungeon
editing, session planning, catalog data, encounters, and party state. It is
being rebuilt as a secure Electron application; the former JavaFX app is
preserved as Git reference `javafx-final-2026-07-27`.

## Local application handoff

For an app-relevant change, build, verify, package, smoke-test, back up and
install the exact current workspace with:

```bash
pnpm handoff:app
```

This command advances one idempotent handoff state for the immutable application
SHA through candidate qualification, check, package, packaged smoke, backup,
deployment staging, activation, and installed-runtime verification. Repeating
the command safely revalidates and reuses completed phases whose input and
output hashes still match. `pnpm handoff:app -- --resume` records explicit
recovery intent without replacing the original state's provenance. Atomic state
and per-attempt audit records live below `.tmp/handoff-local-app/`.

Launch **SaltMarcher Local** from the desktop menu afterwards. Its title
contains the first twelve characters of the embedded app-build fingerprint, so a
stale installation is visible. Packaging and installation refuse output whose
workspace/app-input fingerprint, commit, dirty state, toolchain or output bytes
differ from the receipt. Build channels are explicit: `pnpm build:development`,
`pnpm build:local`, and `pnpm build:release`; their packages are isolated below
`release/development`, `release/local`, and `release/release`.

Use `pnpm dev` only when actively developing with HMR. It intentionally keeps
the fast source-driven loop and is not the manual acceptance path. The removed
`pnpm start` command no longer surprises by rebuilding the complete renderer.

## Local Data

HMR development uses the disposable `development-data` store with an explicit
reset policy. The Linux `SaltMarcher Local` channel has a separate XDG profile
under `$XDG_DATA_HOME/salt-marcher-local/profile` and stores its valuable data
in `campaign-data`; existing development data is never imported or changed.

Local updates require the app to be closed. The installer validates every
SQLite database, refuses untested schema changes, and creates a hash-documented
backup under `$XDG_DATA_HOME/salt-marcher-local/backups` before replacing the
AppImage, icon and desktop entry. Main and the offline installer acquire the
same profile lock, so migration cannot race a running utility process. A
durable install journal recovers an interrupted update to a wholly old or
wholly new state on the next installer run. Immutable deployments and backups
are never deleted automatically. If the packaged app encounters incompatible
data at startup, it preserves every file and explains that a compatible build
or tested migration is required.

Useful lower-level commands are `pnpm package:local:built` for already checked
Local output and `pnpm install:local:built` for an already packaged local
artifact. Both enforce build identity; normal handoff should use
`pnpm handoff:app`.

## Project Map

- `src/`: Electron main, preload, core, renderer, and shared code
- `resources/`: retained static product data and artwork
- `docs/`: canonical project and feature documentation

Start with `docs/README.md` for the documentation map.
