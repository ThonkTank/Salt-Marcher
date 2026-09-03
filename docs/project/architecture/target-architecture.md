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

The utility boundary is supervised by one generation-bound state machine.
Every request has a ten-second deadline; interrupted reads fail retryably,
while an interrupted write reports `outcome_unknown` and is never
automatically replayed. Messages from obsolete generations and terminating
children are rejected. Startup configuration and ready/failure messages are
validated as one discriminated protocol. Only retryable internal bootstrap
failures enter bounded backoff; incompatible, corrupt, inaccessible, missing,
or invalid startup resources produce terminal, user-visible states without a
restart loop.

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

Every renderer-to-Main invocation is declared once in its owning aggregate's
operation fragment under `src/shared/contracts/operations/`. A declaration
owns its key, channel, validated input/output, read/write mode, required handler
process, allowed window roles, deadline, redacted diagnostic category, and any
post-commit travel reconciliation. `operations.ts` only composes those
fragments into the Core and Main registries. Shared protocol types, Main
registration, both preloads, and Utility handler completeness derive from the
composed registries. Duplicate, missing, extra, or wrong-process handlers fail
closed; Utility composition modules bind handlers to whole fragments without
maintaining parallel key unions. The Utility application root coordinates
bootstrap, lifecycle, and composition and contains no aggregate operation-key
inventory.

Electron invocation failures never depend on JavaScript `Error` identity
surviving context isolation. Main catches every registered invocation and
returns one strict discriminated result DTO: immutable validated payload on
success, or capability code, retryability, and bounded issues on failure. The
preloads validate and freeze that DTO and expose the raw GM surface only as
`saltMarcherBridge`; the renderer-owned capability adapter unwraps it and
constructs the logical `CapabilityError` in the renderer realm. Error handling
therefore uses `instanceof CapabilityError` only and never infers a domain code
from arbitrary `message`, `name`, or `code` properties. The passive preload
validates the same result envelope independently without acquiring the GM
surface.

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
`features/travel` owns a provider-neutral reducer and separate view-projection,
query, command, and remote-reconciliation modules; `features/hex` adapts axial
maps, chunk invalidations, evaluations, and commands;
`features/workspace/integrations` lazily composes both. The thin Travel
composition hook owns only one instance-bound async coordinator and wires those
modules. Context, map, and evaluation reads use latest-only scope/entity keys;
commands use one FIFO key per provider and focused Scene. View publication is
additionally bound to provider identity and renderer-local intent, map, and
route revisions, so a remote result that began before a newer local decision
may refresh newer provider truth but cannot replace that decision. Scope
cleanup cancels pending work and removes the provider subscription; stale or
aborted outcomes do not enter the user error channel. Hex is the only
implemented provider. Dungeon remains future work. Route rejection crosses IPC
as a reason code plus optional blocking coordinate, while localized copy stays
in the renderer. Every successful Hex travel mutation returns the new travel
and Session projections together from one utility command boundary.

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
Renderer-local asynchronous ordering has one instance-bound coordinator. A
request is identified by scope and optional entity key and declares either
latest-only or queue semantics; cancellation is carried by `AbortSignal`.
The coordinator owns transient request tokens and pending, success, stale, and
failure state. Feature controllers dispatch domain outcomes only after that
coordinator accepts them, so reducers do not retain infrastructure tokens and
an older result or failure cannot overwrite or obscure newer state. Coordinator
instances belong to hooks and are never mutable module singletons. Queue mode
is FIFO within one scope/entity key and independent across keys. Each entry runs
transport first, rechecks lifecycle and cancellation, and only then runs its
serialized acceptance callback; a failed entry does not poison the following
tail, while a stale entry never reaches acceptance. Renderer features outside
the coordinator do not own Promise-tail queues.

Hex writes use the active Campaign as the creation scope and the immutable map
ID as the existing-map scope. User input and target identity are captured at
dispatch, while the expected map revision is selected inside the queued
transport after the previous accepted projection. The Hex composition hook
only wires the shared coordinator, a narrow transport/receipt-recovery port,
map and location command modules, and an immutable result projector. Receipt
recovery and cache/catalog/viewport projection are not implemented in the
composition hook, and an off-screen map result cannot replace the current map
view.

The Session Planner composition hook wires separate workspace/draft, Session
command, Encounter-search, preparation-lifecycle, and reward-materialization
owners. Workspace state maintains a renderer-local authored-intent revision in
addition to the persisted Session revision. Encounter search uses the shared
coordinator's latest-only mode and binds acceptance to Session identity,
Session revision, selected scene, authored intent, and normalized query; effect
cleanup clears its debounce timer and aborts the obsolete request scope. It
does not retain a manual request epoch. Preparation retains its durable
operation identity but aborts renderer acceptance when the Session or authored
intent changes, and only the active operation may reconcile a receipt or
publish a succeeded workspace. Session commands remain revision-bound and
serialize per displayed Session; a successful non-current result may refresh
catalog summaries but cannot replace newer authored state. Reward
materialization retains one idempotent command identity per generated reward
and applies its refreshed workspace only while the initiating Session authority
is still current.
Architecture gates for renderer ownership inspect TypeScript syntax trees,
imports, calls, and structurally discovered owners. They do not encode file
length, formatting, or local import aliases as architecture. Every semantic
gate that replaces a source-text assertion carries a controlled mutation that
demonstrates the protected boundary still fails closed.
Local Electron E2E runs require explicit available-memory and free-swap
headroom before launch. They preserve per-attempt logs and screenshots, use
cgroup/kernel evidence to distinguish OOM from renderer tab crashes and product
assertions, and stop the run after a confirmed OOM. WDIO receives the real
Electron executable rather than its package shim, making `ldd` and fuse checks
authoritative; package-name-only dependency hints are retained in raw logs but
treated as diagnostic noise, while actual binary linkage failures remain
visible. One app session is reused within a suite only. Suites keep fresh
fixture-backed profiles and processes because even suites sharing a fixture
mutate that profile.
Superseded root-level AppImages and version-one ownership markers are not an
installation cleanup input. The storage inventory reports them as unsupported,
non-application-reachable data, and automated maintenance preserves them
regardless of whether their former ownership evidence still validates.
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
their providers. NPC and Location each expose a thin composition controller
over separate query, mutation, and immutable view-projection adapters. Each
composition owns one instance-bound async coordinator; adapters receive it
explicitly, and deactivation cancels the whole section scope. Query adapters
use latest-only acceptance for pages, details, reference data, and independent
reference retries. Mutation adapters retain command identity and receipt
recovery but publish only coordinator-accepted results. Reducers contain no
request epochs or infrastructure tokens. Narrow renderer-local capability
ports make these rules testable without widening IPC. The creature-collection
manager owns its header, named grid areas, catalog pane, draft pane, footer,
and divider; consumers may choose only a fixed divider or the manager's
accessible resizable model.
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
it under an explicit reset policy. Packaged/local-profile data is always
preserved unless a registered and tested forward migration is promoted from a
verified backup.

No legacy Java compatibility bridge, Java runtime, JDBC layer, or generic ORM
is part of this architecture.

World Location catalog data and its map presentation are separate revisioned
records in the same campaign store. Map reads project the resolved built-in or
custom marker into each location placement; renderers do not join campaign
locations with the installation symbol catalog. Custom marker definitions are
installation-owned, searched through bounded pages, and parsed from a strict
one-path SVG subset in the utility process. Their destructive lifecycle is an
installation command: every campaign database, including recoverable trash,
is rewritten to the built-in `location` fallback before deletion completes.
The installation journal makes an interrupted deletion resumable.

Campaign replacement and Campaign import share one Utility-owned,
cross-resource publish state machine: `staged`, `validated`, `swapped`,
`reopened`, `registered`, `verified`, `finalized`.
`CampaignLifecycleCoordinator` alone decides rollback versus roll-forward and
coordinates narrow filesystem, connection, registry, and domain-verification
ports. Import contributes its atomic registry write and aggregate readback to
those ports; its domain receipt does not duplicate lifecycle decisions.
Recovery before the atomic registry marker restores the last validated image.
Recovery after it validates the current store and registry projection before
removing replacement storage. Journal writes and cleanup are monotonic and
restartable.

All SQLite connections enable foreign keys, WAL, full synchronous durability,
and a bounded busy timeout. Stores carry one neutral whole-database schema
version. The version contract is owned per database role rather than inferred
from a filename discovered at runtime. Current role versions and every complete
forward path are derived from the executable registry and checked against the
[version-truth matrix](version-truth.md); this document does not carry a second
editable version table.

The composed registry has the contract version recorded in that matrix. It orders owner-provided steps
but contains no aggregate SQL itself. A database at an older version without a
complete, unique forward path is a terminal `migration-missing` outcome; a
newer version is incompatible. There is no best-effort opening or implicit
reset of preserved data.

Before a writable connection, startup recursively snapshots the complete
persistence tree, including WAL and SHM sidecars, without opening the source
databases. It runs `quick_check` and reads `user_version` only on the temporary
snapshot, then removes it. This keeps the source tree byte-for-byte and
metadata-stable during preflight. Development may reset only its fixed isolated
root under the explicit reset policy. Packaged data is preserved; supported
migrations are applied by the offline installer to a staged copy of the
complete tree in one transaction per database, validated, then promoted by
directory rename. Missing paths, missing migration chains, corruption, and
access failures remain distinct terminal outcomes. Installation preferences,
including theme and Session layout, use one revisions-protected SQLite record
rather than renderer storage or Main-process JSON. Its JSON column contains a
strict version-one persistence envelope around the logical preferences value.
Bootstrap, reads, and current writes accept only that envelope; the explicit
installation-schema migration wraps the previous logical value without
advancing its optimistic revision.

Pixi rendering is invalidation-driven. Scene, camera, overlay, and resize
changes coalesce into one animation frame; a static map never schedules its
successor. Resize notifications are ignored when pixel dimensions are
unchanged. The Travel acceptance fixture records render counters and reason
counters and requires a zero-render idle interval.

The canonical local check performs a read-only preflight before expensive
work. It rejects insufficient memory plus swap headroom, workspace disk, or an
incompatible Node/pnpm toolchain with measured reasons. A normal invocation is
always fresh. Explicit `pnpm check --resume` may reuse only completed phases
from an atomic state whose commit, workspace inputs, toolchain, check contract,
and predecessor evidence still match; reusable build output is independently
hash-validated before any built or packaged test is skipped.

Before that completion gate, `pnpm iterate <area>` provides the deliberately
narrow owner-feedback loop for `characters`, `encounter`, `combat`, and `loot`.
It executes a manifest-owned typecheck and focused unit/integration set, then
starts the actual HMR application against disposable `development-data`. The
window title identifies the selected area, current commit prefix, and dirty
state. It neither packages nor installs, cannot open Local `campaign-data`, and
does not produce release evidence. Its result is therefore useful for rapid
behavior iteration but cannot satisfy check, handoff, or promotion.

Every build starts with an empty output directory and writes receipt format 2.
It binds commit/dirty state, the full workspace fingerprint, a separate
fingerprint of actual application build inputs, an explicit CLI-selected
channel, both role schema versions, migration-registry version, Node/pnpm/
Electron/electron-vite/electron-builder versions, platform/architecture, every
output path, byte length, SHA-256, and an aggregate output hash. Build time is
provenance only. The receipt excludes itself from the recursive output hash.
Packaging rechecks workspace, app inputs, toolchain, channel, and every output
byte, then embeds the complete receipt plus its hash and the AppImage hash in
the artifact manifest. Development, Local, and release packages use
`release/development`, `release/local`, and `release/release`; Linux smoke tests
execute the actual AppImage. Candidate CI produces the Local package in the
required Linux package job, smoke-tests it, and publishes exactly the AppImage,
its artifact manifest, and a strict candidate-artifact receipt as one immutable
run artifact. Every required pull-request job explicitly checks out the
candidate head SHA recorded by the workflow run, never GitHub's synthetic merge
commit. The outer receipt binds the GitHub repository, workflow run and
attempt, exact application SHA, artifact name, app-input fingerprint, complete
build-receipt hash, artifact-manifest hash, AppImage hash, and build-toolchain
identity.

The only supported `main` promotion is a linear fast-forward of that unchanged
candidate SHA through the typed delivery orchestrator. Before the push, it
verifies the live repository policy, the complete successful required-job
manifest, the exact-SHA aggregate, and any application handoff required by a
changed app-input fingerprint. GitHub independently enforces the managed
SaltMarcher ruleset for `refs/heads/main`: the aggregate check is required and
bound to GitHub Actions, deletion and non-fast-forward updates are denied, and
there are no bypass actors. The classic branch protection remains an additive
guard. A missing, stale, differently sourced, or differently hashed proof fails
closed; documentation-only changes do not manufacture an application handoff.

Local installation is serialized by the same exclusive profile lock that Main
holds for the complete Local application lifetime. A
stale lock is reclaimed only when its PID and Linux process identity (boot,
start tick, executable) no longer match. The installer is an explicitly
authorized offline-maintenance component outside Main and the utility process;
it is the sole component allowed to migrate an inactive Local profile.

Every installation persists an fsync-backed journal before backup, migration,
deployment, each previous-file move, each promotion, and completion. On the
next invocation, the journal and actual `current` pointer deterministically
finish the new state or restore the old one. Non-database files are copied and
hashed in one pass. Each declared live SQLite database is instead captured
through SQLite's Online Backup API into the staged backup, validated, stripped
of SQLite-owned sidecars, and included in the manifest's logical data
fingerprint. Exact declared `<database>-wal` and `<database>-shm` paths are
excluded from the ordinary file copy; similarly named user files are not.
Current backup manifests record this snapshot method, role-specific schema,
both build identities, file hashes, and the logical source-data hash. Legacy
format-one backups remain preserved and visible to inventory but are excluded
from automatic restore and pruning.
Campaign backups are never automatically deleted. They may be removed only by
an explicit single-target maintenance command that proves the complete backup
manifest and file inventory, refuses the five newest backups and backups under
30 days old, and remains a dry-run without the exact manifest SHA. Crossing 50
backups or 1 GiB produces a non-blocking storage warning only.
`pnpm local-storage:inspect -- --json` is the read-only inventory boundary;
`pnpm local-storage:prune -- --backup <name> --confirm-manifest-sha <sha>` is
the sole deletion boundary and accepts exactly one direct-child backup name.

Immutable deployments are eligible for automatic retention only after the
installed runtime has been verified. Retention keeps the active deployment,
the two newest valid inactive deployments, and every deployment referenced by
a nonterminal installation journal. A deletion candidate must be a direct
64-hex child whose directory fingerprint, artifact manifest, receipt hash,
AppImage hash, icon hash, and ownership all validate immediately before
removal. Unknown, damaged, ambiguous, journal-protected, or foreign entries are
reported and preserved. Deletion failures fail the retention checkpoint but do
not roll back the already verified installation.

The installer stages fingerprint-addressed deployments and atomically switches
one `current` symlink only after all deployment files are durable. For each
immutable application SHA, the handoff advances one explicit state through
`candidate-qualified`, `checked`, `packaged`, `packaged-smoke-passed`,
`backup-created`, `deployment-staged`, `activated`, and
`installed-runtime-verified`, then `storage-retention-applied`. The final
checkpoint records retained and deleted deployment fingerprints, findings,
warnings, and actually released bytes. Every phase binds its predecessor output
and its own result by SHA-256 and is reusable only while current evidence still
matches.
Repeated invocations are safe and append audit attempts; they do not create a
parallel state or replace the original state's provenance. Explicit `--resume`
records recovery intent but follows the same validation rules. Auth, live
candidate evidence, disk capacity, and installation availability are checked
before a material state or attempt is created. The handoff downloads only the
artifact belonging to the exact successful required-job run, verifies its
closed three-file inventory and complete hash chain, and accepts it only when
its clean SHA, workspace and app-input fingerprint match the local candidate.
Final SHA-keyed state receipts are permanent. Invocation and per-attempt detail
retention keeps the newest 100 terminal records and every nonterminal record;
only detail files no longer referenced after that classification may be
removed.

`pnpm handoff:app --dry-run` is a separate isolated rehearsal, not a handoff
checkpoint. It may build a dirty workspace, snapshots a selected live profile
with the same SQLite-online semantics, and exercises the actual packaged app
under temporary XDG roots. It never creates canonical handoff receipts,
retention state, permanent campaign backups, deployments, or a live
activation, is incompatible with `--resume`, and removes its temporary root on
success or failure.

The read-only storage inventory also owns the compatibility topology across
profile databases and lifecycle journals, every retained backup, active and
retained deployments, the installation journal, and Handoff state and
invocation history. It distinguishes current, migratable, explicitly
unsupported-obsolete, and unknown-invalid artifacts. Unknown,
integrity-invalid, or obsolete artifacts are preserved and are never made
application-reachable merely to classify them. A shared typed registry is the
allowlist for every local persistence envelope. Its intentional version-one
contracts include candidate-artifact receipts, campaign-backup manifests,
profile locks, storage inventories, compatibility inventories, and retention
progress/receipts; a version number has no meaning without its named contract.

The one-time compatibility evacuation completed before its readers were
removed. It is not a continuing retention or installation capability.
Campaign-lifecycle receipts, install journals, installed/deployment manifests,
Handoff invocation histories, and per-attempt audit layout now accept only
their current contract and produce an explicit actual-versus-expected version
error otherwise. The pre-deployment root AppImage/marker cleanup is absent;
such bytes are inventory-only unsupported data and remain fail-closed. Older
database schemas in immutable backups may remain classified as migratable,
but are not application-reachable. Handoff retention is reusable only when its
post-operation compatibility scan reports that every application-reachable
artifact is current; its retained legacy-reader count is structurally zero.

Remote required-job evidence satisfies `checked`; the downloaded Local package
satisfies `packaged`. The actual downloaded AppImage is still smoke-tested on
the handoff host before any campaign backup, deployment, activation, or
installed-runtime verification. Each phase records status, start, duration,
hashes, and any terminal error.
Candidate promotion requires this completed exact-SHA state precisely when the
candidate app-build fingerprint differs from `origin/main`; qualification,
delivery-tooling, and documentation-only changes do not manufacture an
application handoff.

Installed-runtime acceptance requires utility generation 1 to reach `ready`.
The total utility bootstrap budget is 5000 ms; phase budgets are configuration
250 ms, campaign store 2000 ms, generator presets 500 ms, Session Generation
catalog 2000 ms, and recovery 1000 ms. These deterministic deadlines complement
the idle render/wakeup counters; hardware CPU percentages remain evidence only.

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
histories, cached drafts, paired catalog/work views, serializable discard
intents, and external conflicts. Its thin composition controller receives
narrow Creature, Group, Loot, and lifecycle ports from the sole capability
adapter, creates one instance-bound async coordinator, and injects it into the
existing query and command boundaries. Loot writes, intent execution, and the
immutable view projection are separate modules; the composition controller
only owns the reducer, derives its current inputs, and wires those boundaries.
Views import neither live Session surface types nor capability hooks. Scene
scope cleanup cancels pending reads and writes. All discarding
transitions use one intent policy, and only coordinator-accepted asynchronous
outcomes reach the reducer. The reusable Treasure editor receives messages,
issues, commands, and an add policy instead of importing feature copy or
authoritative catalog metadata.

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
