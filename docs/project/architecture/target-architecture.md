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

Cross-feature World Location editing is composed only by
`features/workspace/integrations`. Catalog, Hex, and World Planner do not import
one another's concrete screens, controllers, capability adapters, or styles.
The normative cross-feature journeys and their required evidence are tracked
in the
[World Location editor acceptance matrix](world-location-editor-acceptance-matrix.md).
The integration receives narrow feature application ports and owns the optional
Hex field and its staged placement state. A utility-process application command
coordinates the deliberately sequential save-then-place workflow and returns a
durable complete or partial-success receipt. User placement drafts contain only
map identity and coordinates; the utility process resolves Hex state at commit
time. An unknown IPC outcome is reconciled by the outer command identity and is
never blindly replayed.

Session travel uses the same composition boundary. Session owns explicit map
and scenario render slots and imports neither Hex nor Travel implementation.
`features/travel` owns a provider-neutral reducer, request gates, and command
protocol; `features/hex` adapts axial maps, chunk invalidations, evaluations,
and commands; `features/workspace/integrations` lazily composes both. Hex is the
only implemented provider. Dungeon remains future work. Route rejection crosses
IPC as a reason code plus optional blocking coordinate, while localized copy
stays in the renderer. Every successful Hex travel mutation returns the new
travel and Session projections together from one utility command boundary.

The editing state has one explicit owner at every phase:

| State | Owner | Lifetime |
| --- | --- | --- |
| location form draft and validation | World Planner dialog | one dialog instance |
| tag suggestions | bounded World Planner read capability | one query response, maximum ten values |
| optional placement draft | Workspace integration | one integrated editor instance |
| map catalog, biomes, chunks, and exact invalidation | general Hex map projection port | explicit transient or shared-owner projection lifetime |
| location catalog revision | World Planner aggregate | resolved by the base-save workflow |
| Hex content revision | Hex aggregate | resolved immediately before place/remove |
| partial-save operation receipt | utility-process operation journal | until success or explicit retry |

The durable save journal is a World Planner aggregate adapter in
`core/worldplanner`, backed by the owner-prefixed
`worldplanner_location_save_operation` table. The orchestration command in
`core/application` depends only on the journal port and contains no SQL or
database handle. Both the integrated Location save and the direct Hex
location-placement tool reach the same revision-free placement command; the
legacy renderer-owned revision/retry path is not a public capability.

Save behavior is deliberately sequential and never presented as atomic. The
base save and a durable partial receipt commit together before placement is
attempted:

| Base save | Placement | Result |
| --- | --- | --- |
| rejected | not attempted | failed; the editable draft remains |
| applied | unchanged/applied | saved |
| applied | typed rejection or unavailable | partially saved; the location remains durable and retry repeats placement only |

The World Planner dialog exposes a generic side-area render port and does not
contain Hex placement types, map revisions, capability access, or Hex styles.
The compact and expanded placement views share one draft; opening the expanded
view unmounts the compact heavy canvas, Cancel restores its baseline, and Apply
keeps the staged selection without persisting it.

The capability provider is the sole renderer composition boundary. Feature
application adapters receive its `SaltMarcherApi` value and return narrow,
entity-focused ports; pure controllers and command executors receive those
ports explicitly. Revision selection, command identities, receipt
reconciliation, and snapshot accumulation live in those adapters rather than
in React components. Mutable module-level capability registries and renderer
service locators are forbidden.
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
One Hex-owned World Location projection controller is the sole owner of its
location snapshot, exact invalidation subscription, optimistic presentation
drafts, and conflict recovery. Symbol and creation workflows submit typed
actions to that owner instead of replacing catalog snapshots themselves.
The bundle gate verifies this static dependency graph, preserves the original
entry and 900 KiB Workspace-JavaScript ceilings, and enforces separately
calibrated complete initial, Workspace, feature, Pixi-leaf, and reachable-total
graphs. The 3.20 MiB hard renderer ceiling protects the larger of ten percent
or 256 KiB from ordinary growth. Exact budgets, accounting semantics, current
calibration, and the required justification for any future increase live in
the [renderer bundle inventory](renderer-bundle-inventory.md).
Generated chunk names are not architectural identities. The bundle inventory
resolves the common Workspace graph and renderer leaves by stable manifest
module identity rather than matching generated keys or hashes.

Catalog is a composition root over Monster, Location, Faction, and Encounter
Table controllers and views. Controller state remains mounted across section
changes, while an explicit active flag prevents hidden sections from reading
their providers. Narrow renderer-local capability ports make these rules
testable without widening IPC. The creature-collection manager owns its header,
named grid areas, catalog pane, draft pane, footer, and divider; consumers may
choose only a fixed divider or the manager's accessible resizable model.
The domain-owned World Location editor is shared by Catalog and Hex through a
narrow application port. Location, Faction, Encounter Table, and Hex Map saves
return both the next immutable projection and the exact saved entity; consumers
never infer command results by diffing aggregate IDs. A Workspace-owned
integration adapter composes the editor with narrow map, faction, and
encounter-table creation ports. Related editors are rendered as siblings in a
Workspace-owned dialog stack, so the still-mounted parent draft receives the
exact child record without nesting one modal form below another in the React
tree.
The shared faction dialog similarly composes the shared encounter-table dialog
for create-and-select without owning Encounter Table persistence. Both dialogs
publish renderer-local, entity-focused render contracts instead of importing
one another's component implementation. Encounter-table snapshots expose
installation and campaign as separate scope snapshots. Each scope carries its
own revision, tables, and utility-computed picker summaries. A renderer
application accumulator reconciles each scope independently, so React
consumers neither compare partially ordered revisions nor issue one Creature
detail request per entry merely to render table options.

The current Location catalog keeps its in-memory snapshot search while the
pre-release load profile remains below all of these measured escalation
thresholds: 2,000 locations, a 5 MiB encoded Location snapshot, and 150 ms p95
for filter-plus-sort on the low reference profile. Crossing any threshold in a
representative fixture requires a bounded, server-side paginated query port
before release; raising a threshold requires a recorded profile with the same
fixture and hardware class. Tag suggestions are already independently bounded
at the IPC contract and never require downloading the Location snapshot.

All blocking dialogs render through the shell-owned overlay layer. The layer
portals dialogs outside the application root, maintains one ordered stack for
modals, alert dialogs, and anchored popups, makes the application and lower
dialogs inert, traps focus only in the active scope, restores focus on close,
and centrally owns Escape, outside-pointer dismissal, and body-scroll handling.
The stack paints one shared scrim behind its bottom modal while lower dialogs
remain visibly contextual beneath the active layer. Potentially destructive
close actions open a sibling `alertdialog` when a draft is dirty. Form-like
editors use one shell-owned fixed-header/scrolling-body/fixed-footer frame.

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
tile, biome-ID, and marker rows. Reads always request bounded chunks and carry
only the referenced installation-owned biome definitions; the renderer may
draw an empty unbounded guide grid, but only authored tiles have biomes or
accept travel and markers. Travel progression
is clocked by the utility process and publishes revision changes. Reads are
pure observations and never advance Scene time.

Session Generation persists immutable `session` and `group_reward` run kinds
as normalized owner tables. Engine and catalog versions are independent audit
fields. Stored rows contain typed domain facts, not localized renderer copy or
an aggregate JSON snapshot. Session Planner is the only whole-day workflow;
Group management exposes the narrower group-draft reward generator. Its
immutable preview records a prospective or persisted group identity and the
complete normalized living/dead roster. Confirmation crosses Scene and Loot
only through one Utility-owned transaction that saves the group, reconciles
Combat, accepts the Treasure, and records its idempotent receipt atomically.

Session Generation catalogs are immutable artifacts behind one validated
registry. New generation uses the explicitly active artifact; reads and commits
for an existing run resolve its exact version and content hash even after a
later artifact is activated. Verified full catalogs and prepared Loot search
indexes are lazy caches keyed by content hash. Import publishes a new directory
and registry atomically, never overwrites a published artifact, and changes the
active version only explicitly.

Group management is a renderer application boundary rather than a stateful
view. One `GroupManagerState` reducer owns per-Group sessions, Group and Loot
histories, request tokens, cached drafts, paired catalog/work views, serializable
discard intents, and external conflicts. Its controller receives narrow
Creature, Group, Loot, and lifecycle ports from the sole capability adapter;
views import neither live Session surface types nor capability hooks. All
discarding transitions use one intent policy and delayed responses can mutate
state only when their token is current. The reusable Treasure editor receives
messages, issues, commands, and an add policy instead of importing feature copy
or authoritative catalog metadata.

Loot is a separate feature projection with its own revision and
`loot.changed` event. `LiveSessionSnapshot` contains Party, Scene, Travel, and
Combat truth but no Loot aggregate. Loot command receipts store canonical
request fingerprints and exact original typed results. Campaign rules own the
revisioned base-versus-adjusted XP policy used consistently by Combat awards
and group-reward budgets.

Schema 27 represents Treasure item and container provenance as closed
discriminated unions. SQL stores `catalog_entry_kind` and generated container
identity with constraints for nullability, magic/rarity/curse combinations,
stackability, quantity, and unique generated origins. Generated proposals and
edited Group drafts both materialize into one internal Treasure shape and pass
through one Loot-owned aggregate writer. Group-reward coordination orders
receipt lookup, immutable-source and revision guards, catalog-backed
materialization, Group mutation, Treasure write, revision bump, and receipt in
one transaction. Validation failures can carry bounded issue codes, stable
Draft-ID paths, and primitive parameters across Utility, Main, Preload, and
Renderer without localized text or filesystem details.

Session preparation is a durable staged journal. It freezes canonical input
and party levels before generation, then references the immutable run and
stores normalized prepared scenes before the final Session compare-and-swap.
Utility-process restart resumes the latest active stage; cancel and failure are
terminal audit states and never compensate immutable foreign artifacts.

Hex editing commands carry stable command identities, publish exact changed
chunk notices, and retain a bounded persistent per-map content history. Brush
geometry is shared pure code; the utility process recomputes committed targets
from path and radius rather than trusting renderer-expanded tile sets.
Renderer mutations share one receipt-aware command executor: an
`outcome_unknown` response is reconciled by command identity and is never
blindly replayed.

German messages expose separate plain and parameterized key types. Placeholder
names are inferred from the message template, required at compile time and
validated again at runtime. Copy is split into bounded Workspace, Reference,
Session, Hex, Catalog, and common UI dictionaries, with one typed assembly
module. Electron bundles WOFF2 only; legacy WOFF copies are rejected by the
bundle gate.

Reference lookup follows the same boundary. A deterministic, attributed SRD
artifact is checked into the application and loaded only by the utility
process. The utility composes that static truth with the canonical creature
catalog and campaign-owned location and faction services, then publishes
separate static and Campaign revisioned indexes plus normalized documents
through three typed read capabilities and one typed invalidation event.
The renderer compiles matching state locally; hover traversal performs detail
reads but never receives filesystem, database, or runtime network access.
