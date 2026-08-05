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

Renderer recovery is also a process boundary. A shell-owned `ModuleHost`
loads each application or workspace surface explicitly, distinguishes module
load failures from React render failures, keeps the surrounding shell usable,
and reports a bounded `RendererIncident` through the preload bridge. Only Main
may reload a renderer `WebContents`; renderer code cannot call browser-global
reload APIs. Main additionally records main-frame load failures, preload
failures, renderer process termination and responsiveness transitions without
navigation URLs, preload paths, exception messages, or campaign data.
Incidents carry only bounded scope, phase, code, workspace, safe error class
and recovery class fields.

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

Renderer features depend on shared renderer primitives, never on sibling
workspaces. Creature search state and controls live in the `creatures` feature;
the reusable two-pane editor lives in `creature-collection`; Session groups and
Encounter Tables compose those features without importing Catalog from Session
or Session from Catalog. Each feature imports and owns its feature stylesheet;
shell styles contain only application-wide primitives.

The capability provider is the sole renderer composition boundary. Feature
adapters receive its `SaltMarcherApi` value and return narrow ports; pure
controllers and command executors receive those ports explicitly. Mutable
module-level capability registries and renderer service locators are forbidden.
Workspace navigation is described by immutable `WorkspaceDefinition` records,
including identity, label, icon, loader, neutral layout mode and recovery
policy, rather than parallel conditionals in the shell. Its route host models
loading, ready, module failure and render failure explicitly. Module failures
can request a Main-owned renderer reload; render failures remount locally or
return to Session while Top Bar, Rail and Campaign control remain usable.

Pixi is a leaf dependency of `hex-map-canvas-pixi.tsx`. The lightweight canvas
surface dynamically loads that implementation behind its own `ModuleHost`, so
Session, Catalog and the common Workspace graph do not eagerly include Pixi or
its renderer backends. The Hex editor composes independent catalog, canvas and
state panes around its reducer controller. Pixi-specific drawing stays in the
adapter, while camera math and pointer gesture state live in Pixi-free modules.
The bundle gate verifies this static dependency graph, a 900 KiB Workspace
ceiling and a 2.75 MiB total normal-renderer ceiling.

Catalog is a composition root over Monster, Location, Faction, and Encounter
Table controllers and views. Controller state remains mounted across section
changes, while an explicit active flag prevents hidden sections from reading
their providers. Narrow renderer-local capability ports make these rules
testable without widening IPC. The creature-collection manager owns its header,
named grid areas, catalog pane, draft pane, footer, and divider; consumers may
choose only a fixed divider or the manager's accessible resizable model.

All blocking dialogs render through the shell-owned modal layer. The layer
portals dialogs outside the application root, maintains a single ordered modal
stack, makes the application and lower dialogs inert, traps focus only in the
top dialog, restores focus on close, and centrally owns Escape and body-scroll
handling. Potentially destructive close actions open a nested `alertdialog`
when a draft is dirty. Dialog buttons therefore request one close command
rather than directly manipulating unrelated workspace state.

## Data ownership

`installation.sqlite` holds registry, settings, and reusable definitions.
Each campaign owns `campaigns/<id>/campaign.sqlite`. A utility process alone
opens these stores. Until the first accepted real-use release, the application
uses an isolated development data directory and schema changes may recreate
it. That release freezes the SQLite format; only then do forward migrations
begin.

No legacy data migration, compatibility bridge, Java runtime, JDBC layer, or
generic ORM is part of this architecture.

World Location catalog data and its map presentation are separate revisioned
records in the same campaign store. Map reads project the resolved built-in or
custom marker into each location placement; renderers do not join campaign
locations with the installation symbol catalog. Custom marker definitions are
installation-owned, searched through bounded pages, and parsed from a strict
one-path SVG subset in the utility process. Their destructive lifecycle is an
installation command: every campaign database, including recoverable trash,
is rewritten to the built-in `location` fallback before deletion completes.
The installation journal makes an interrupted deletion resumable.

All SQLite connections enable foreign keys, WAL, full synchronous durability,
and a bounded busy timeout. Development stores carry one whole-database schema
version. On mismatch, startup removes only the fixed isolated
`development-data` root and immediately creates the current schema; it neither
runs migrations nor exposes a compatibility error as normal application
behavior. Installation preferences, including theme and Session layout, use
one revisions-protected SQLite record rather than renderer storage or
Main-process JSON.

Hex maps use an unbounded axial coordinate space backed by sparse authored
tile, terrain, and marker rows. Reads always request bounded chunks; the
renderer may draw an empty unbounded guide grid, but only authored tiles have
terrain or accept travel and markers. Travel progression
is clocked by the utility process and publishes revision changes. Reads are
pure observations and never advance Scene time.

Hex editing commands carry stable command identities, publish exact changed
chunk notices, and retain a bounded persistent per-map content history. Brush
geometry is shared pure code; the utility process recomputes committed targets
from path and radius rather than trusting renderer-expanded tile sets.
Renderer mutations share one receipt-aware command executor: an
`outcome_unknown` response is reconciled by command identity and is never
blindly replayed.

German messages expose separate plain and parameterized key types. Placeholder
names are inferred from the message template, required at compile time and
validated again at runtime. Electron bundles WOFF2 only; legacy WOFF copies are
rejected by the bundle gate.

Reference lookup follows the same boundary. A deterministic, attributed SRD
artifact is checked into the application and loaded only by the utility
process. The utility composes that static truth with the canonical creature
catalog and campaign-owned location and faction services, then publishes
separate static and Campaign revisioned indexes plus normalized documents
through three typed read capabilities and one typed invalidation event.
The renderer compiles matching state locally; hover traversal performs detail
reads but never receives filesystem, database, or runtime network access.
