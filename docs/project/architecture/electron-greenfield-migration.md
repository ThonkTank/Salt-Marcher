# Electron greenfield migration

## Historical status record

> This versioned document records the greenfield migration decisions at the
> time they were made. It is not the current delivery or completion status.
> Executable schema/engine/catalog state lives in `version-truth.md`; current
> work status lives in active GitHub issues and pull requests, while durable
> measurement evidence belongs in `../evidence/`.

**Recorded milestone: M1 — qualification was in progress.** M0 was complete. The
retired implementation is preserved by tag `javafx-final-2026-07-27` and the
`stable` branch at the same final JavaFX commit. The
secure Electron shell, utility-process SQLite
campaign skeleton, and Pixi/Babylon prototypes are present. Typecheck, lint,
unit/integration tests, build, headless Electron smoke test, and Linux AppImage
packaging pass locally. The project has a WebdriverIO Electron journey and
axe-core now covers Campaign, Session, Catalog, Hex and dialogs in both themes,
plus the automated 200%-scale and pseudo-locale journeys. CI runs native
packaging on all three target systems plus the Linux E2E gate. Remaining M1
acceptance evidence is the measured RP-H p95, context-loss, real 200%-scale and
screen-reader qualification recorded in `m1-render-qualification.md`.

The qualification harness is now a separate renderer entry and Babylon is no
longer copied wholesale into the normal application. Runtime hardening now
includes request deadlines, read/write interruption semantics, a
generation-bound Core supervisor, typed bootstrap and terminal failures, one
neutral SQLite schema version with read-only preflight and explicit migration
contracts, SQLite-owned installation preferences, utility-driven Hex travel,
unbounded sparse Hex viewports, and a dedicated fail-closed passive preload.
Automated architecture and normal-bundle budget gates protect these boundaries.
Every renderer invocation is now declared in one aggregate-owned operation
fragment and composed into the shared Core or Main registry. The same
declaration supplies schemas, read/write classification, handler owner,
deadline and redacted diagnostics to Main, preload, supervision, and Utility.
Typed fragment-bound handler maps and fail-closed runtime composition replace
parallel handler-key inventories; successful-result effects remain with their
owning composition, while the Utility root contains only generic lifecycle and
composition policy. Main lifecycle, registration, runtime observation and role
resolution are separate modules. Renderer styling is split into tokens, shell
and owning feature styles. Session, Catalog, Hex, Party and Encounter each
route through an owning capability adapter and keep asynchronous or reducer
state in feature hooks. Static JSX copy and accessibility labels come from the
typed German message catalog. AST and mutation tests prevent these boundaries
from regressing.
Renderer controller ownership now derives from imports, hook calls, and the
structurally discovered reducer owner; line-count gates, symbol-spelling checks,
and duplicate controller inventories are not architectural contracts.
Electron E2E execution now preflights memory/swap, resolves the actual Electron
binary for native diagnostics, preserves artifacts per attempt, and classifies
kernel OOM, tab crash, runner failure, and product assertion separately. A
confirmed OOM stops remaining suites; a confirmed tab crash suppresses further
renderer screenshot attempts. Cross-suite session reuse remains disallowed by
fresh fixture/profile isolation, while tests inside one suite share its session.
Renderer Session mutations and Group management now share one instance-bound
async command coordinator with scope/entity request identity, latest-only and
queue modes, `AbortSignal` cancellation, and explicit pending/success/stale/
failure state. Stale results and failures are rejected before they reach domain
callbacks. Group query and write hooks own the asynchronous work, while the
pure reducer and composition controller contain no request-token inventory.
Application and workspace modules now load through shell-owned failure
isolation with structured renderer incidents and Main-controlled reload.
Renderer feature ports are injected from React context; the mutable capability
singleton has been removed. Pixi is loaded only at a visible Hex canvas. The
common Workspace JavaScript graph remains below the 829,440-byte refactor
acceptance boundary. The normal renderer has a 3.20 MiB hard ceiling with ten percent held
back as corrective-work reserve instead of operating at the previous 2.80 MiB
byte boundary. The 0.05 MiB increase
accounts for the bounded virtual biome catalog and CRUD surface added with
schema 15; schema 16 replaced separate World Location kind and region fields
with tags and read-aloud text, and schema 17 normalizes ordered location-owned
tags into validated rows while all per-entry ceilings remain unchanged.
Campaign schema 34, installation schema 35, migration registry 7, Generator Config V5, Encounter engine
`encounter-v5`, and Reward engine `reward-v3` are current. Persisted
`reward-v2` runs remain readable. The checked
[version-truth matrix](version-truth.md) owns these current values. Schema 25 is reset rather than migrated. The
versioned behavior and ownership are recorded in the
[Encounter Generation requirements](../../encounter/requirements/requirements-encounter-generation.md)
and ADRs 0001/0002; this progress record does not duplicate them. The bundle
inventory stops Pixi measurement at the HTML-entry back-edge so unrelated
dynamic Workspace siblings cannot be charged to the Pixi leaf.
Legacy WOFF duplicates
are excluded, and typed message placeholders fail closed. The canonical check
now also runs the complete Campaign-walking/Hex journey against the built
application.
The Hex editor now composes catalog, canvas and state panes around its reducer;
Pixi drawing, camera logic and gesture state have distinct testable boundaries,
and both initialization and later canvas-cycle failures retain their cause in
renderer incidents. Its production shell now follows the high-fidelity
three-tool design: the utility process persists location-owned map presentation,
Main performs bounded SVG file selection, an installation-wide one-path symbol
catalog owns custom glyph data, and the renderer combines Pixi biomes with an
inline SVG marker and curved-label overlay. Map presentation has its own
optimistic revision and patch command; chunk projections carry complete,
immutable marker render data so other map surfaces do not join renderer-side
catalog snapshots. Location and symbol mutations publish explicit invalidation
events. Symbol search is paged, SVG validation runs only in the utility process,
and symbol deletion is a durable installation command which replaces references
with the built-in `location` marker across active and trashed campaigns before
removing the catalog entry.
The Hex location projection now has one renderer owner for catalog,
presentation, symbol, and creation reconciliation. The shared World Location
editor uses a narrow World Planner port, and creation returns the exact new
entity. Create-then-place remains an explicit two-step workflow so an authored
location survives a rejected placement with a visible partial-success outcome.
The dialog itself is Hex-agnostic and composes a generic side area; a Workspace
integration owns its revision-free placement draft. Location tags use ordered
relational rows and a bounded suggestion capability, selection controls share
one keyboard-accessible combobox primitive, and the typed German copy catalog
is assembled from bounded feature dictionaries.
Session travel now follows the same ownership model: Session is a small layout
composer with explicit map/scenario slots, the Workspace integration lazily
selects a provider, Travel owns the generic reducer and request gates, and Hex
owns the only current adapter. Hex mutations return Travel and Session
projections together; evaluation failures and travel hints are structured codes
rather than localized domain strings. Pointer handling is an exclusive gesture
state machine, keyboard navigation is a Pixi-free command controller, and the
former feature-wide Session/Hex stylesheets are split into component-owned
files without reciprocal selectors.
The travel E2E suite uses one versioned, materialized fixture registered in the
central suite catalog rather than browser-side seed logic.
Pixi rendering is demand-driven: explicit scene, overlay, camera, and resize
invalidations coalesce into one frame, unchanged resize observations are
ignored, and the materialized Travel fixture proves a static interval with
`renderDelta: 0` plus unchanged per-reason counters.

The Linux manual-acceptance path now uses a separate `SaltMarcher Local`
AppImage identity and XDG profile. Receipt format 2 carries commit, dirty
state, workspace and app-input fingerprints, provenance build time, role
schemas, migration registry, toolchain, platform, and the output hash manifest;
that receipt is embedded in the package and the workspace fingerprint remains
visible in the window title. Development opens only explicit reset-policy data, while every
packaged process uses preserve policy and reports incompatible data as a
terminal, non-restarting status. The local installer refuses stale or running
artifacts and concurrent installers. It performs a recursive read-only SQLite
preflight, refuses schema changes without a unique tested migration chain,
creates permanent hash-manifested campaign-data backups, migrates only staged
copies, and promotes immutable fingerprint-addressed deployments through one
atomic `current` link. Every clean-channel build has a receipt containing
hashes for all output files and an aggregate hash; packaging verifies it
against the workspace. The single `pnpm handoff:app` path advances the exact
candidate SHA through candidate qualification, remote-check attestation,
validated acquisition of the exact CI-built Local package, local actual-AppImage
smoke, backup creation, deployment staging, atomic activation, and
installed-runtime verification in that order. Candidate CI binds the Local
AppImage and embedded Build Receipt to its repository, run, attempt, SHA,
app-input fingerprint, toolchain identity, manifest hash, and artifact hash in
one strict immutable artifact. Every required PR job checks out that candidate
head SHA explicitly rather than qualifying a synthetic merge commit. The
handoff refuses extra files, another run or
SHA, a changed local app input, or any broken hash link. Repeated calls
revalidate and reuse only phases whose predecessor and output hashes still
match the atomic SHA state. Explicit `--resume` records recovery intent without
replacing the state's original provenance. `pnpm dev` remains HMR-only.

## NPC catalog and preserved profile schema — 2026-08-16

The active Catalog now includes a lazy-loaded campaign NPC vertical slice.
NPC commands cross the restricted bridge with strict immutable carriers,
idempotent receipts, and paired NPC/faction optimistic revisions for normalized
single-faction membership. NPCs reference Creature-owned statblocks and may
carry lifecycle, appearance, behavior, history, notes, disposition, faction,
and location facts. Catalog supplies debounced search, status/faction/location
filters, Inspector readback, guarded editing, and confirmed deletion. Reference
indexing publishes exact NPC names and resolves current Creature, faction,
location, and NPC facts.

Party profile carriers and persistence now include optional species, class,
ordered canonical-unique languages, passive Investigation, and passive Insight.
Schema 29 adds these nullable fields, the language relation, NPC tables, and
owner migration ledgers through the tested 28-to-29 path while preserving
existing campaign rows. NPC Encounter participation, inferred combat losses,
generator stock participation, and custom Creature statblocks remain outside
this slice.

## World Planner ownership and query reset — 2026-08-17

World Planner is the sole owner of NPC persistence and normalized faction
membership. `WorldNpcApplicationService` requires a Creature reference resolver
and faction membership coordinator for mutations; Encounter Source no longer
forwards NPC commands. Schema 33 adds database-enforced location `SET NULL` and
faction-membership `CASCADE` semantics through the tested 32-to-33 migration.

The public NPC catalog uses bounded server-side search pages without profile
prose and loads one resolved detail projection on selection. Receipts retain
only the saved/deleted outcome and resulting revisions inside a 1,000-command
idempotency window. A reverse Reference dependency index maps Creature,
Faction, and Location changes to affected NPC documents; typed change
descriptors replace whole-index/whole-document before-and-after serialization.
Party schema initialization is empty, example characters are explicit fixture
data, and persistence delegates XP, rest, travel-position, and Adventuring Day
rules to database-independent domain functions.

## Campaign import product capability — 2026-08-17

`CampaignImportBundle` V1 is the durable, Zod-validated intermediate format.
It binds source identity, revision, canonical export hash, declared sections,
external entity keys, and explicit species, language, statblock, faction, and
location decisions. Utility owns `validate`, `preview`, and `apply`; renderer
and Main never receive filesystem or SQLite access.

Apply builds a complete schema-34 campaign database under isolated staging,
runs domain readback and SQLite `quick_check`, then activates it. Re-import
replaces the prior imported database at the same campaign identity only after
the staged image passes. Source revision, hash, sections, resolutions, and
external-key mappings are persisted for deterministic preview and idempotent
delta handling. The Tower-of-Time revision-6098 fixture and semantic Golden
cover Hank's PP/languages and the prior mixed-language mapping decisions.
Filesystem maintenance callers must prove the exact deployment-receipt SHA
before opening a profile; normal calls run through the compatible installed
Utility process.

Replacement and import now publish through the same persisted seven-phase
`CampaignLifecycleCoordinator`. The former directory transition and the import
saga no longer make independent rollback or roll-forward decisions. Filesystem,
connection, Campaign/import registration, and domain readback are narrow ports;
the atomic registry marker is the recovery decision boundary. Startup retains
the previous validated directory until the replacement store and registry
projection have both been verified. Existing directory receipts are migrated
in place without changing either SQLite data format.

## Runtime efficiency and delivery hardening — 2026-08-15

The architecture-critique remediation was delivered in six independently
verifiable phases:

1. Core lifecycle flags and split message parsing were replaced by a
   generation-bound state machine, discriminated protocol, request tracker,
   event router, measured bootstrap phases, and terminal startup taxonomy.
2. Pixi's implicit redraw behavior was replaced by an invalidation scheduler;
   the real Travel fixture supplies the idle-render evidence.
3. Persisted data is classified with a read-only preflight before any writable
   connection. Schema names are environment-neutral and forward migrations
   require one explicit registry chain and transactional contract tests. The
   role contract is installation schema 35 at `installation.sqlite` and
   campaign schema 34 at `campaigns/<id>/campaign.sqlite`; registry version 7
   supports the Golden-Master-backed 27 -> 28 path, the 28 -> 29
   NPC/structured-PC migration, the 29 -> 30 application migration, and the
   populated 30 -> 31 canonical-item migration, and the 31 -> 32 Config-V5 and
   raw reward-member migration, and the 32 -> 33 World Planner relational
   integrity migration, the 33 -> 34 import provenance/registry migration, and
   the 34 -> 35 durable import-saga migration. The aggregate owners
   retain their SQL, and the installer is the only offline migration authority.
4. Local installation uses a lock, permanent verified backups, staged data
   migration, immutable version deployments, atomic current selection, and
   rollback/recovery paths.
5. Clean output roots and receipt format 2 bind workspace and app-input
   fingerprints, CLI-selected channel, role schemas, migration registry,
   toolchain, platform, and every emitted byte. Development, Local, and release
   outputs are isolated, and Linux qualification executes the actual AppImage.
6. The eight-phase, SHA-keyed handoff is idempotent. Every invocation validates
   candidate, workspace, app-input, qualification, delivery, toolchain, output,
   artifact, backup, deployment, activation, and installation evidence before
   reusing it. Per-attempt audit records retain the original state's provenance,
   and every phase records status, duration, input/output hashes, evidence, and
   errors before installed generation-one runtime acceptance. Required
   candidate CI publishes a smoke-tested Local artifact whose outer receipt
   binds the exact workflow run/attempt and the embedded Build Receipt. Handoff
   reuses that artifact only after complete run, inventory, input, toolchain,
   manifest, and byte-hash validation; host smoke, data backup, installation,
   and runtime verification remain local.
7. Local storage retention is a post-runtime, hash-chained handoff checkpoint.
   It keeps the active deployment, two valid inactive predecessors, and every
   nonterminal-journal reference; invalid or foreign entries remain untouched.
   Campaign backups are never automatically deleted and require exact,
   single-target manifest confirmation. Terminal invocation details are capped
   at 100 while SHA state receipts and nonterminal attempts remain durable.

The editor application-layer refactor tracks its normative evidence in
`application-layer-refactor-acceptance-matrix.md`. It moves the two-step
Location save into a durable utility-process command without presenting it as
atomic, replaces whole Encounter Table revision comparisons with scope
snapshots, normalizes exact-entity mutation receipts, and moves nested editors
to a shell-owned sibling overlay stack.

## Decisions

- Rebuild in the same repository; do not mechanically translate Java code.
- Product specifications, acceptance cases, load profiles, static catalogs,
  reference tables, and Golden Masters are retained. Java source is behavior
  reference only.
- There is no parallel operation, old-development-data opening requirement, or
  SQLite conversion path.
- Each capability arrives as a vertical product slice.

## Roadmap

### M0 — target foundation

Preserve the retired baseline by tag, document this target architecture and
roadmap, retire source-specific architecture, make issue evidence
product-neutral, close superseded Java PRs after retaining their visible
requirements, and add this contributor guide.

### M1 — qualifying foundation (Go/No-Go)

Replace the retired application with a secure Electron/React shell,
one canonical `pnpm check`, cross-platform CI and packaging. Build a
utility-process-owned campaign skeleton that creates name-only campaigns,
switches A/B/A, and resumes exactly after restart. Qualify PixiJS at 100,000
sparse cells/8,192 visible facts and Babylon chunks, camera, hover, picking,
and selection on the defined integrated-GPU laptop profile: camera/hover p95
≤16 ms and local preview p95 ≤50 ms. Simulate memory/GPU loss and verify
keyboard use, 200% scaling, and accessible alternative representations.

### M2 — campaign knowledge and common catalog

UUIDv7 identities, campaign objects and reusable definitions, NPCs, places,
factions, quests, rumours, notes, FTS5, virtualized catalog, name-only dialog,
independent cross-campaign copies, trash/restore, and typed rejections.

### M3 — running play state

Roster and party; primary/shared running scenes; assignments; independent
scene time; weather and overrides; encounter/chase masks; notes/search;
durable scene/encounter/travel state; and a read-only secondary window.

### M4 — spatial platform

Deliver usable slices for shared coordinate/camera/selection, sparse chunk
storage, Pixi hex map, Babylon voxel dungeon, semantic spatial objects and
tools, 200-step undo/redo, synchronized views, geometry-loss reassignment,
and party routing/exploration/travel interruption. Store compact voxel chunks;
SQLite indexes chunks, revisions, semantic objects, and spatial bounding boxes
instead of individual voxels.

### M5 — planning, encounter, generators

Session workspace/timeline, planning party, placed content, creature/item
catalogs, encounter lifecycle, editable loot, and pure TypeScript rules.
Implement confirmed behavior anew with Golden Masters, reference snapshots,
seeds, stable ordering, and explainable diffs.

Current progress: the `saltmarcher-v5` generation capability now runs in
the utility process over a packaged, manifest-verified session-generation
catalog. A validated immutable artifact registry preserves historical catalogs
by version and content hash, chooses one explicit active catalog for new runs,
and lazily caches full catalogs and Loot indexes by hash. The importer refuses
artifact replacement and atomically publishes registry changes. It covers
session XP, exact encounter-target allocation, the Sheet-v1
automatic encounter-count rule, generated preset role/CR candidate construction,
streaming lexicographic selection, difficulty, bossiness, reward channels,
normal and overstock treasures, item and magic resolution, packing, and
integrity audits. Complete immutable GeneratedRuns are campaign-persisted and
deduplicated by semantic-origin fingerprint in owner-prefixed root and child
tables. The dedicated Session Planner authors persisted timelines and performs
one staged Generate flow that commits the run, concrete Encounter-owned saved
plans, rests, and typed reward references before one optimistic Planner
replacement. Generated rewards materialize idempotently as editable Treasures.
Loot owns exclusive unplaced/location/group anchors, unresolved-reference
fallbacks, atomic partial distribution, original-result retry receipts, and a
separate append-only Character Loot ledger with linked corrections. Session
group/location cards, Encounter Resolution, Party/Roster, and the shared
distribution dialog consume those typed capabilities.

The Group reward now uses one renderer `GroupManagerState` owner for
per-Group Group/Loot drafts, semantic histories, discard intents, paired work
views, and external conflicts. Narrow views, query/write hooks, and capability
ports surround that reducer; renderer request ordering belongs to the shared
async coordinator rather than Group state. Schema 31 introduced canonical item references in
Generated Runs, Treasures, and Character Loot while generated and legacy
definitions each have one immutable owner. Group drafts keep the generated
item/container set fixed and edit only quantity and packing. All generated
acceptance paths share one materialized-Treasure aggregate writer.
The atomic coordinator has explicit source/revision guard and draft
materialization phases. Group Loot editor and commit/restart evidence use two
focused, resumable E2E suites with their own atomic result records.

### M6 — completeness and first data-format release

Music/autoplay, import/export, backup/recovery/salvage, tutorial, optional
actor autonomy, platform accessibility, localization/scaling, large campaigns,
installers, and all 78 confirmed GM-core cases. Then freeze the SQLite format.

## First change packages

1. `docs: adopt Electron target and retire legacy gates`
2. `build: establish secure Electron shell`
3. `feat: create switch and reopen campaigns`
4. `feat: qualify sparse Pixi and Babylon renderers`

The Go/No-Go decision follows package 4. Do not broaden feature work before
that decision.

This is a feature freeze: only qualification evidence, defects, security,
fault containment, diagnostics, dependency-boundary work and changes required
to reach the M1 Go/No-Go may enter before the decision is recorded.

## Historical blockers at the recorded milestone

At this point in the migration, M1 could not be accepted until the recorded integrated-GPU qualification and
accessibility evidence is attached. This is a gate, not a reason to weaken the
16-ms/50-ms budgets. Store reproducible measurements in
`docs/project/evidence/`; track current CI state in the relevant pull request.

## Approved historical vertical slice

**Go/No-Go scope record — 2026-08-09.** The owner-approved implementation
exception includes the complete Session Planner and Loot vertical slice:
immutable normalized GeneratedRuns, concrete generated Encounter plans, typed
Treasure acceptance and anchoring, atomic distribution, and the Character Loot
ledger. This records authorization before the slice's implementation without
claiming that the open M1 qualification gate has passed or authorizing unrelated
feature expansion.

The first running-play slice crosses the roadmap labels deliberately without
claiming completion of M3 or M5. Its approved expansion contains:

- the complete Party roster dropdown, Party membership, progression, rests,
  and the separate Adventuring Day top-bar calculator; the focused Scene shows
  Party as the first allied row in the compact group register and owns only Scene assignment; joining
  the Party atomically assigns the PC to the focused Scene
- anchored burger-menu Campaign CRUD without an icon-rail Campaign workspace,
  including rename, recoverable trash/restore, exact-name permanent deletion,
  and crash-reconciled `.trash`/`.deleting` directory transitions in the
  complete greenfield schema v27
- the productive Monster and campaign-local NPC sections of the common
  Catalog, backed by the versioned local SRD 5.1 resource; NPCs select existing
  statblocks and support revisioned CRUD, filters and Inspector details, while
  NPC Encounter participation remains a later product
- one focused persistent runtime Scene with explicit PC assignments and named
  GM creature groups carrying an optional note, visual disposition, archive
  state, aggregate revision, and stable Scene-owned members; incompatible
  pre-v8 development data is discarded and rebuilt instead of migrated; one
  two-pane builder creates empty or populated groups and combines the shared
  filtered creature catalog, transient manual editing, live balancing, and
  fill-or-replace generation for new or existing groups before an explicit save
- scenario tabs for Encounter and an interactive provider-owned Reise console;
  Encounter consumes
  only selected Scene groups and owns difficulty evaluation, Initiative,
  Combat turn state, and Resolution, with a four-phase breadcrumb, monster-only
  initiative rolls, Scene-owned individual member HP/conditions, bounded
  persisted undo and Group-Manager reinforcement; Resolution consumes typed
  group treasure identities and opens the shared Loot distribution dialog
- a dedicated Session Planner rail workspace with persisted Session CRUD,
  participants, ordered editable Scenes, rest gaps, saved Encounter search,
  live XP budget, atomic dirty-save switching, and one cancellable preparation
  flow that turns a complete GeneratedRun into concrete Encounter plans and
  typed reward cards without an intermediate Apply step
- immutable `saltmarcher-v5` GeneratedRuns over all 21 manifest-verified local
  catalog tables, exact CP/rational budget stages, isolated named SHA-256
  entropy streams, structured rewards/packing/audits, normalized child storage,
  and idempotency by semantic-origin fingerprint; the public encounter-only
  generation operation has been retired
- Sheet-parity Loot rules now live as fixed-shape editable Config-V4 preset
  tables. Session and group rewards calculate the positive cumulative
  post-reward XP deficit from Character-ledger item references, persist that
  basis in normalized rows, accept a successful empty reward, and retain the
  prior catalog artifact for historical run replay
- campaign-local mutable Treasures with exactly one unplaced, location, or
  Scene-group anchor, multiple treasures per anchor, repairable last-known
  labels, idempotent generated acceptance, shared Encounter/Quest distribution,
  transactionally coupled allocations and ledger awards, and append-only linked
  ledger corrections
- inline group-draft reward generation with normalized living/dead provenance,
  hidden independent entropy, a renderer-local quantity/packing draft,
per-Group undo/redo caching and discard protection, an immutable-run-pinned
  read-only Loot catalog, informational value/magic budgets, and one atomic
  idempotent Group-plus-Treasure confirmation command; schema 31 migrated copied
  item facts to shared catalog/generated/legacy references
- a persistent three-column Session surface with independently resizable
  control/group and scenario columns around a flexible Details/Katalog/Karte
  center, focused-scene control, shared catalog filtering, app-lifetime
  Campaign/Scene-scoped detail history, inline and active-monster-following statblocks, and an honest
  provider-ready map/route-planning shell; Combat is persisted independently per
  running Scene
- campaign-local World Planner location and faction CRUD plus authored
  Encounter Tables in Catalog; locations link factions and tables, factions
  own disposition, a primary table and optional finite inventory caps, while
  Scene stores only a stable focused-location reference
- the shared location editor creates and immediately links missing Hex maps,
  factions, and Encounter Tables through Workspace integration ports without
  resetting its draft; the same map, faction, and table dialogs serve their
  direct and nested entry points
- one shared source resolver supplies both the visible Monster catalog and the
  Scene-group generator with union-within/intersection-across semantics,
  weighted deterministic ranking, finite caps, and explicit fallback/no-
  solution behavior
- Scene groups and Encounter Tables share one two-pane creature-collection
  manager component rather than parallel look-alike dialogs; faction stock is
  edited only from the selected table's creature membership
- Catalog, Session, Encounter Table, creature search, and creature collection
  are one-way renderer features rather than workspace-to-workspace imports.
  Their blocking surfaces use one portal-based modal stack with inert lower
  layers, one shared scrim, visible contextual parents, focus restoration, and
  a shared dirty-draft discard alert; modal-owned anchored popups retain the
  same Escape and focus order
- the Catalog composition root keeps all existing section-controller state
  alive while narrow injectable capability ports suppress reads from inactive
  sections; the shared creature-collection manager owns every named layout
  area and exposes fixed or accessible resizable divider models instead of an
  implicit child-order contract
- one campaign-local Hex vertical slice now connects a Pixi editor, shared
  installation-owned biome IDs, World Planner location placement, focused-Scene
  Party position, waypoint route planning, durable checkpoints and Scene time,
  and the shared Session Karte/Reise state; Karte is a borderless canvas while
  Reise owns map selection, accessible Party placement, route planning,
  evaluation, and runtime transport controls; its editor exposes visible brush levels
  `1..10` over mathematical radii `0..9`, immediate catalog-location placement,
  location-owned marker presentation, and installation-wide custom one-path SVG
  symbols; a paged virtual palette owns protected built-ins and unlimited
  custom biome CRUD, installation-wide weighted encounter pools, and recoverable
  cross-campaign placeholder replacement after custom-biome deletion
- one offline reference-graph slice compiles attributed SRD 5.1 rules and
  creatures from one pinned archive into deterministic local artifacts,
  publishes separate static and campaign world indexes from the utility
  process, highlights read-only Session prose, opens typed details
  in Scene-local history, supports recursively nested hover cards, and keeps
  explicitly pinned cards as movable memory-only windows

Encounter-table, faction, and location filter controls appear only when their
owning providers publish real options. NPC membership and stock consumption
remain later work. The slice uses only secure typed capabilities
and utility-process-owned feature stores; it does not introduce copied creature
truth, a Java compatibility layer, or claim that the open M1 qualification
gate is complete.
