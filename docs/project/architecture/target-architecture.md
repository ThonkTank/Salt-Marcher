# Electron target architecture

SaltMarcher is rebuilt in this repository as a local Electron desktop
application. The JavaFX implementation is preserved only by Git tag
`javafx-final-2026-07-27`; it is neither a parallel runtime nor a source
architecture to extend.

## Runtime boundary

```text
React / PixiJS / Babylon.js
          │
          ▼
Zod-validated, narrow preload capability bridge
          │
          ▼
Electron main: windows, permissions, lifecycle, security
          │
          ▼
Utility process: domain, commands, SQLite, generation, background work
```

The renderer runs with sandboxing and context isolation, with Node integration
disabled, a restrictive CSP, and local content only. It cannot access Node.js,
the filesystem, or SQLite. Main and preload expose only explicit capabilities;
they do not become service locators.

The utility boundary is supervised. Every request has a ten-second deadline;
interrupted reads fail retryably, while an interrupted write reports
`outcome_unknown` and is never automatically replayed. Crashes restart with
bounded backoff and the still-responsive shell exposes explicit recovery after
the retry budget is exhausted.

The passive second-monitor window uses a separate fail-closed preload. It
exposes only the typed party-safe projection read/change notification and Core
status; Main rejects every privileged GM capability from that window role
before validating input or reaching the utility process.

## Source shape

```text
src/
├── main/{application-lifecycle,windows,security,core-process}
├── preload/capability-bridge
├── utility
├── core/{application,encounter,hex,party,persistence,reference,scene,worldplanner}
├── renderer/{shell,features,spatial-2d,spatial-3d}
└── shared/{contracts,ids,errors,qualification}
```

Electron, React, TypeScript, `electron-vite`, `electron-builder`, PixiJS,
Babylon.js, `better-sqlite3`, Zod, Vitest, Testing Library, WebdriverIO and
axe-core are mandatory parts of the target stack. Electron is pinned to one
stable version at installation time. WebGL 2 is the rendering baseline;
WebGPU is optional acceleration only.

All renderer-to-Main invocations are declared in
`src/shared/contracts/operations.ts` with channel, validated input/output,
read/write mode, allowed window roles and deadline. Core kinds use the same
table to type the supervisor protocol and the exhaustive utility handler map.

## Data ownership

`installation.sqlite` holds registry, settings, and reusable definitions.
Each campaign owns `campaigns/<id>/campaign.sqlite`. A utility process alone
opens these stores. Until the first accepted real-use release, the application
uses an isolated development data directory and schema changes may recreate
it. That release freezes the SQLite format; only then do forward migrations
begin.

No legacy data migration, compatibility bridge, Java runtime, JDBC layer, or
generic ORM is part of this architecture.

All SQLite connections enable foreign keys, WAL, full synchronous durability,
and a bounded busy timeout. Development stores carry one whole-database schema
version. On mismatch, startup removes only the fixed isolated
`development-data` root and immediately creates the current schema; it neither
runs migrations nor exposes a compatibility error as normal application
behavior. Installation preferences, including theme and Session layout, use
one revisions-protected SQLite record rather than renderer storage or
Main-process JSON.

Hex maps use an unbounded axial coordinate space backed by sparse authored
terrain and marker rows. Reads always request a bounded viewport window; the
implicit default terrain is generated only for that window. Travel progression
is clocked by the utility process and publishes revision changes. Reads are
pure observations and never advance Scene time.

Reference lookup follows the same boundary. A deterministic, attributed SRD
artifact is checked into the application and loaded only by the utility
process. The utility composes that static truth with the canonical creature
catalog and campaign-owned location and faction services, then publishes a
revisioned index and normalized documents through two typed read capabilities.
The renderer compiles matching state locally; hover traversal performs detail
reads but never receives filesystem, database, or runtime network access.
