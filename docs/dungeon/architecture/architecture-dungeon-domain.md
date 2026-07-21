Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-21
Source of Truth: Candidate Greenfield target architecture derived from the
accepted Dungeon needs baseline. It becomes binding only after owner acceptance.

# Dungeon Greenfield Target Architecture

## Purpose And Review Boundary

This specification defines the long-term system shape needed to author, run,
exchange, and extend Dungeons while preserving one coherent truth and the GM's
authority. Its primary consumers are maintainers of Dungeon authoring, travel,
runtime simulation, persistence, and presentation integrations.

This is result 2 of the Dungeon refactor review. It is derived from the active
requirements without treating current code, packages, storage, tests, migration
cost, or the previous architecture document as precedent. The current
implementation is deliberately not evaluated here. Result 3 will compare the
pre-refactor state, final refactor state, and the owner-accepted form of this
candidate target.

The target assumes only the confirmed product constraints: one local GM-operated
application, durable local data, no direct player control, no collaborative
multi-user authoring, and no runtime plugin system. It does not require a
particular programming language, UI toolkit, or database product.

### Current-State Quarantine

Current domain, contract, source-architecture, and enforcement documents remain
evidence of the implementation's intended design, not inputs to this target.
Their compatibility with this specification is intentionally unresolved. This
Draft creates no migration allowance and makes no claim that current tests or
packages already satisfy it.

## Stakeholders And Concerns

| Stakeholder | Architectural concern |
| --- | --- |
| GM | No lost authored work, clear previews and rejections, responsive large-Dungeon work, recoverable failures, and final authority over fictional outcomes. |
| Feature developer | A new authored family, tool, travel rule, or integration changes one explicit capability slice rather than unrelated features. |
| Maintainer | One owner per durable fact, visible dependency direction, bounded consistency rules, replaceable adapters, and diagnosable failures. |
| Data custodian | Atomic commits, restore-tested migration, versioned exchange, archival and trash semantics, and separation of authored and runtime data. |
| UI developer | Stable capability interfaces and revisioned projections without reconstructing domain input from presentation state. |

## Architecture Drivers

The following needs materially determine the architecture:

- one unbounded sparse 3D Dungeon with at least 100,000 authored cells
- equal raster and graph authoring entry points plus a synchronized Dungeon Key
- stable authored identity independent of changing geometry
- immediate durable commits, transient previews, protected graph drafts, and
  session-scoped undo/redo
- live authoring during exploration without partial geometry, actor, route, or
  time state
- cell-precise travel, extensible perception, tracks, passive player output,
  and project-wide actor autonomy over the same committed spatial facts
- atomic cross-Dungeon links, travel segments, and campaign-time autonomy steps
- portable authored packages that exclude runtime state and history
- local adapter replacement and compile-time extensibility without a generic
  runtime plugin framework
- the measurable latency, progress, and cancellation budgets owned by the
  active requirements

## Target System Style

SaltMarcher is one local capability-modular application. Capability modules own
business state and publish typed commands and queries. Presentation, storage,
background execution, and rendering are adapters around those capabilities.

A single local deployment is preferred because the confirmed use case has one
operator and requires atomic changes across authored geometry, runtime position,
campaign time, and owner-provided effects. Distributed services would introduce
partial-failure and synchronization costs without satisfying a user need.

The architecture uses four state classes and never merges their ownership:

1. **Authored truth**: portable GM-created Dungeon definitions and references.
2. **Runtime truth**: current exploration, environment, knowledge, travel, and
   autonomy state; durable locally but excluded from authored packages.
3. **Derived state**: replaceable graph, key, viewport, routing, visibility,
   diagnostics, and description projections computed from committed truth.
4. **Interaction state**: camera, hover, selection gestures, previews, and
   protected draft workspaces; transient until an explicit commit.

### Authority And Automation Boundary

The GM is the only interface operator and the final owner of unrestricted
fictional outcomes. Dungeon and project capabilities may calculate objective
spatial, travel, perception, timing, and trigger facts, then expose a typed
prompt or prepared operation. They cannot infer permission, success, damage,
trap outcome, Encounter resolution, or another free table decision from prose,
appearance, tags, or geometry.

Actor Autonomy is the single bounded exception. It acts only for explicitly
enabled NPCs or monsters, confirmed campaign time, configured jobs, and allowed
consequences. Party involvement or another GM-owned decision stops preparation
before mutation. An external capability may be changed only through an explicit
operation prepared and validated by that owner.

## Capability Context

### Figure 1: Logical capability context

Arrows mean “uses the published capability of”. Named capability boxes are
business owners; the transaction mechanism owns no business state.
Presentation and storage adapters are outside the ownership boxes.

```text
Adapters --commands/queries--> [Catalog]
Adapters --commands/queries--> [Authoring Workspace]
Adapters --queries-----------> [Query Projections]
Adapters --commands----------> [Exchange]
Adapters --commands----------> [Recovery]

[Authoring Workspace] --commands--> [Authored World]
[Query Projections] --reads-------> [Authored World]
[Query Projections] --reads-------> [Dungeon Runtime]
[Query Projections] --reads-------> [Perception And Knowledge]
[Exchange] --prepares-------------> [Catalog] + [Authored World]
[Recovery] --runs-----------------> owner-defined migrations

[Authored World] + [Dungeon Runtime] --publish--> [Spatial Context]
[Travel] + [Perception] + [Actor Autonomy] --query--> [Spatial Context]
[Travel] + [Authoring] + [Actor Autonomy] --prepare--> [Campaign Placement]
[Travel] + [Actor Autonomy] --prepare--> [Decision Inbox]

Initiating capability --enlists--> [Campaign Transaction]
[Campaign Transaction] --applies--> owner-defined durable changes + outbox
```

This diagram is logical. It does not prescribe source folders, processes, or
storage tables.

## Capability Ownership

### Dungeon Catalog

Owns Dungeon identity, name, archive/trash lifecycle, duplication request, and
the association between a catalog entry and its authored and runtime roots. It
does not own geometry, runtime positions, or external campaign objects.

`DungeonCatalog` is the only public command entry for archive, unarchive,
restore-from-trash, trash, final destruction, and duplication. Archive changes
Catalog lifecycle state and pauses active Dungeon Runtime atomically while
preserving links and runtime state. Duplication asks the Authored World to
prepare new authored identities and rewritten internal references, preserves
external references, omits runtime and history, then commits the new Catalog and
authored roots together. Exchange and Recovery do not own Catalog lifecycle
commands; Recovery exposes a distinct restore-from-backup operation.

### Dungeon Authored World

Owns the complete portable Dungeon definition:

- voxel geometry, Volumes, explicitly described surface regions, and stable
  authored spatial identities
- Rooms, Levels, room groups, attributes, descriptions, visibility defaults,
  templates, and assignments
- Areas, parametric Paths, Passages, links, Dungeon-owned Trap and Curiosity
  definitions, trigger fields, environmental source definitions, and initial
  mechanism state
- stable placement identities, portable start or design anchors, and references
  for externally owned Encounters, Loot, actors, places, and other campaign
  truth without copying that foreign truth
- authored revision and invariants for one or several Dungeons changed by one
  command

Geometry and semantic content are separate submodels inside the same authored
consistency owner. A geometry mutation may reassociate content, but it cannot
delete stable GM-authored identity. Unassigned content remains queryable until
the GM explicitly deletes it.

The authored world exposes intent-based commands. It does not expose mutable
entities, persistence repositories, render frames, or storage-shaped records.

### Dungeon Authoring Workspace

Owns transient editing activity for one GM:

- selection and active tool state needed to interpret an authoring gesture
- bounded local read snapshots used by previews
- raster previews and protected graph-edit drafts
- the editor session's undo/redo journal
- specific validation conflicts and repair choices

It submits complete authored commands against an expected authored revision.
It never becomes a second authored owner. Camera, hover, caret, popup, and other
passive presentation state remain adapter-local.

A protected graph edit is an isolated draft branch based on one authored
revision. Its raster translation may be repaired without changing committed
truth. Acceptance performs one normal authored commit; discard removes the
entire draft independently of ordinary undo depth.

Every successful undoable authored commit returns an opaque commit receipt with
the affected owner revisions and semantic inverse intents. The workspace stores
receipts rather than owner snapshots. Undo and redo submit new coordinated
commands through the same owner boundaries as the original change; a stale or
conflicting inverse is rejected with repair choices and never partially applied.

### Dungeon Runtime Context

Owns durable Dungeon-local exploration facts that must not enter a portable
authored package:

- current Passage, light, sound, mechanism, Trap charge, and reset state
- physical tracks and transient or persistent Dungeon environmental events
- active exploration context, runtime logs, and runtime archive/pause state
- the authored revision against which current routes and visibility were
  validated

Authored configuration supplies defaults and legal operations. Runtime state
records the current campaign instance. Editing authored geometry during
exploration may propose runtime relocations or invalidations, but only an atomic
campaign commit may publish both results.

### Campaign Placement

Campaign Placement is a project capability. It owns each spatially movable
actor, group, or campaign object's current spatial context, provider-specific
position, and heading, plus committed movement-group membership where
applicable. Party, NPC, monster, item, inventory, and other capabilities retain
their own identity and mechanical truth.

Dungeon defines and validates Dungeon coordinates through Dungeon Spatial
Context; it does not own the foreign actor, group, or object placed at those
coordinates. Travel, authoring relocation, and Actor Autonomy prepare placement
changes through this capability. Moving across a Dungeon, Hex, or external-place
boundary therefore changes one placement truth instead of synchronizing
feature-specific copies.

An authored actor, Encounter, or movable-object placement supplies a stable
placement identity and portable start anchor. Once that actor, group, or object
is active, Campaign Placement is the only current-position owner and the
authored anchor is not another live location. Activation and deactivation are
atomic owner operations. A resolved spatial-binding query returns exactly one
authoritative current anchor and treats simultaneous authored and runtime
currency as an invariant violation. Static Loot and Curiosities remain authored
placements and move only through authoring.

### Dungeon Spatial Context

Publishes read-only spatial capabilities over committed authored and runtime
facts:

- bounded viewport and identity-closure queries
- standability, neighborhood, Passage, route, travel-cost, and arrival facts
- 3D line-of-sight and environmental transmission facts
- nearby Feature, event, track, and job-offer facts
- authored-to-runtime identity resolution

It owns no actor need, job, calendar, Encounter, Loot, or Party truth. Derived
navigation areas may be rebuilt freely because they have no stable identity or
content.

### Dungeon Query Projections

Produces revisioned, immutable projections for raster, graph, Dungeon Key,
detail, diagnostics, document output, and player visibility. All projections
carry the complete authored, runtime, Perception, and other owner revisions from
which they were built. A source-specific projection omits only owners it does
not read. A late result cannot replace a projection built from any newer source
revision.

A specialized view may aggregate or omit facts, but it cannot invent a second
Room, connection, passability, description, knowledge, or selection identity.
Every view addresses the same stable references.

Player display and visibility-filtered export consume only an audience-specific
projection contract. `DungeonAudienceQuery` combines authored, runtime,
Perception, and an explicit audience profile with deny-by-default filtering. Its
closed player-audience result type cannot contain GM-only prose, private
discovery notes, hidden references, diagnostics, or unrestricted authored
objects; a GM-document profile uses a distinct result type rather than optional
player fields. Temporary reveal is an explicit revisioned projection input and
does not change knowledge truth.

### Dungeon Exchange

Owns versioned authored-package import/export, human-readable document export,
and the import-plan lifecycle. It owns no Catalog lifecycle or duplication
command.

- portable packages contain authored truth and external references only
- human-readable export consumes audience projections and a visibility profile
- import first creates a conflict-resolution plan, then commits all accepted
  identity and reference mappings atomically

Imported bytes remain untrusted until an exchange-owned gate has staged them,
validated their allowed format and structure, bounded their resource demand,
and represented external references as import-scoped tokens. Package-provided
paths or identifiers never become local filesystem paths or foreign owner
identities directly. Only a fully validated, GM-resolved import plan may prepare
Catalog and Authored World changes. Exact codec, archive, validation-error, and
resource-limit shapes belong to the package contract.

Storage adapters implement this capability's durable ports; they do not decide
identity, conflict, compatibility, or recovery policy.

### Dungeon Recovery

Owns backup retention policy, manual and pre-migration backup operations,
restore testing, migration orchestration, retry, restore from backup, and the
read-only failure mode. Each business owner still owns its logical schema and
migration. Recovery invokes those migrations against privately staged data and
never becomes an owner of Dungeon meaning.

Recovery artifacts are addressed by internally generated identities beneath an
application-private root. Imported names and paths never select a backup,
backup-restore, trash, or destruction target. Detailed filesystem permissions,
no-follow behavior, and codec rules belong to the recovery contract.

### Project Travel

Travel is a project capability because active movement may cross Dungeon, Hex,
and external place boundaries. It owns journeys, routes, pursuit, exploration
round configuration, movement overrides, interruption state, and the factual
travel log. A Dungeon provider supplies Dungeon-specific route and cost facts.

The full navigable Dungeon travel-control workspace is `Reisen` and uses this
capability. The global compact `Reise` contribution may select and display a
current provider context, but it remains a command-free readback and does not
become another command owner.

### Perception And Knowledge

Perception is a project capability shared by travel, the passive player view,
and actor autonomy. It owns directional actor/group knowledge, active-check
overrides, discovery confirmation, and track-knowledge state. Dungeon supplies
3D geometry, light, cover, sound, senses-relevant environment, and physical
tracks; actor owners supply senses and actor facts.

The same committed perception result feeds GM notification, route interruption,
autonomy, Fog of War, and player output. No presentation adapter recomputes a
private visibility truth.

### Campaign Decision Inbox

The project-wide Decision Inbox owns durable pending GM decisions, delivery
status, acknowledgement, and the continuation or abort reference for the
initiating operation. Event definitions and candidate production remain with
their source owners; the Inbox does not decide fictional outcomes.

Travel interruption and its pending decision commit together. Presentation
reads a durable outbox and may retry delivery idempotently, so a crash or UI
failure after the business commit cannot lose or duplicate the decision.

### Actor Autonomy

Actor Autonomy owns enabled state, needs, job evaluation, reservations, current
jobs, group autonomy decisions, catch-up boundaries, consequence protection,
explanations, and its factual log. Dungeon offers reachable local jobs and
spatial operations. Foreign effects remain commands prepared by their owning
capability.

Its public capability separates GM controls and queries from step execution:
enable, pause, disable, direct job assignment or cancellation, priorities,
protection bounds, catch-up summaries, Decision Inbox references, explanations,
and prepared autonomy steps all remain owned here. The Inbox alone owns and
mutates the referenced pending decisions.

### Use-Case Coordination And Campaign Transactions

The capability that accepts an initiating command owns its stateless use-case
coordination. It names the required participants and coordinates atomic changes
whose invariants span capability owners:

- live authoring plus required actor relocation and route invalidation
- one completed travel segment plus position and campaign time
- one autonomy time step plus needs, jobs, movement, reservations, effects,
  random conflict results, and events
- paired cross-Dungeon Passage links

Authoring coordinates live-edit and undo, Travel coordinates segments, Actor
Autonomy coordinates autonomy steps, Catalog coordinates lifecycle changes, and
Authored World coordinates paired links. There is no central coordinator that
must change for every new operation family.

Each owner first creates a side-effect-free prepared change against immutable
revisioned input. `CampaignTransaction` then enlists the participants, rechecks
their base revisions and invariants inside one short local durable transaction,
applies only owner-defined changes, and commits all or none. Long-running
calculation, routing, perception, and projection work never occurs while the
write transaction is held.

The durable commit includes a receipt containing the resulting owner revisions
and an outbox of facts and pending deliveries. No owner publishes before commit;
publication retries by operation identity and cannot duplicate a business
effect. Cancellation is guaranteed until the operation crosses into the short
commit section. A stale revision, owner rejection, or cancellation before that
frontier applies no change.

## State Ownership And Consistency

| State | Owner | Mutation path | Consistency boundary | Derived consumers |
| --- | --- | --- | --- | --- |
| Dungeon identity and lifecycle | Dungeon Catalog | Catalog lifecycle intent | Catalog plus required Runtime or Authored prepared changes | Catalog, links, runtime entry |
| Dungeon geometry and semantic content | Dungeon Authored World | Validated authored command | One command may cover one or several linked Dungeons | Raster, graph, key, route, export |
| Portable external placement identity and start anchor | Dungeon Authored World | Validated placement authoring | Authored commit or activation with Campaign Placement | Export, duplication, resolved binding |
| Authoring preview and graph draft | Dungeon Authoring Workspace | Tool or graph intent | One transient workspace at a base revision | Authoring adapters only |
| Editor undo/redo | Dungeon Authoring Workspace | Commit receipt submitted as coordinated inverse intent | Current editor session plus every affected owner | Authoring controls |
| Environment and Dungeon-local exploration | Dungeon Runtime Context | Runtime command or prepared campaign change | One Dungeon transaction or initiating campaign operation | Travel, perception, player output |
| Movable actor, group, or object position and heading | Campaign Placement | Owner command, activation, or prepared campaign change | Initiating campaign operation | Dungeon context, travel, perception, autonomy |
| Journey, route, pursuit, movement overrides | Project Travel | Travel intent | One completed route segment | Travel workspace and compact context |
| Campaign time | Calendar owner | Prepared time advance | Initiating campaign operation | Travel, events, autonomy |
| Directional knowledge and discovery | Perception And Knowledge | Perception evaluation or GM override | One perception/campaign step | GM context, autonomy, Fog |
| Pending GM decision and delivery | Campaign Decision Inbox | Prepared decision or acknowledgement | Initiating operation plus durable outbox | Travel, autonomy, GM controls |
| Needs, jobs, reservations, catch-up | Actor Autonomy | Confirmed campaign-time step or GM command | Initiating autonomy operation | Autonomy controls and summaries |
| Encounter, Loot, actor, item, place truth | Owning external capability | Owner command only | Owner-defined or initiating operation | Stable references from Dungeon |
| Import plan and untrusted staging | Dungeon Exchange | Package gate and GM mapping intent | One validated import operation | Import UI and prepared Catalog/Authored changes |
| Backup, migration, and backup-restore operation | Dungeon Recovery | Recovery command against owner migrations | One recovery operation before writable publication | Recovery UI and diagnostics |
| Viewports, graph, key, descriptions, diagnostics | Dungeon Query Projections | Rebuild from committed revisions | Immutable projection revision | GM UI and unrestricted exports |
| Audience-filtered player and export output | Dungeon Query Projections | Rebuild through `DungeonAudienceQuery` | Immutable authored/runtime/perception revision tuple | Player display and filtered export |

No API allows a consumer to update another capability's storage directly.
Cross-owner invariants use owner-defined prepared changes, initiator-owned
coordination, and `CampaignTransaction`, not compensating writes, a central
business coordinator, or shared mutable models.

## Public Capability Interfaces

The names below are semantic interface families, not required code type names.
Detailed payloads, validation, compatibility, and error shapes belong in
contract specifications after this target is accepted.

| Interface | Consumers | Required behavior |
| --- | --- | --- |
| `DungeonCatalog` | Catalog and lifecycle UI | Read identity and lifecycle; coordinate archive, unarchive, restore-from-trash, trash, destroy, and duplication through owner-prepared changes. |
| `DungeonAuthoring` | Raster, graph, key, batch, import | Preview and commit typed intents against expected revisions; return accepted facts or typed rejection. |
| `DungeonWorkspace` | Authoring adapters | Maintain selection, drafts, protected graph work, commit receipts, undo, redo, and conflict repair without owning authored truth. |
| `DungeonQuery` | GM Dungeon views and GM-authorized full document export | Serve bounded immutable projections with stable identities and source revisions. |
| `DungeonAudienceQuery` | Player display and visibility-filtered export | Produce deny-by-default audience DTOs from explicit authored, runtime, perception, reveal, and audience revisions. |
| `DungeonSpatialContext` | Travel, perception, autonomy | Provide route, cost, arrival, visibility, environment, track, and local job-offer facts without foreign business decisions. |
| `DungeonRuntime` | Travel, perception, GM controls, initiating coordinators | Read runtime context and prepare explicit runtime mutations or overrides. |
| `CampaignPlacement` | Authoring, Travel, spatial providers, perception, autonomy | Read and prepare changes to one cross-context position, heading, and applicable movement-group truth. |
| `DungeonExchange` | Import/export UI | Gate and plan untrusted import, commit validated mappings, export authored packages, and render audience-filtered documents. |
| `DungeonRecovery` | Recovery UI | Create and restore-test backups, invoke owner migrations, retry or restore a backup, and keep failed state read-only. |
| `Travel` | Dungeon/Hex workspaces and global compact context | Plan and commit journeys, segments, pursuit, overrides, interruption, and factual log entries. |
| `Perception` | Travel, autonomy, `DungeonAudienceQuery`, and GM views | Evaluate and publish one directional knowledge result with explicit GM override semantics. |
| `CampaignDecisions` | Travel, autonomy, event sources, GM controls | Prepare, deliver, acknowledge, continue, or abort one durable pending GM decision without owning its fictional outcome. |
| `ActorAutonomy` | GM controls and initiating coordinator | Control enabled state and jobs; prepare bounded steps and catch-up; expose explanations, Decision Inbox references, and committed outcomes. |
| `DungeonAuthoredFamilyModule` | Dungeon compile-time composition | Contribute one family's commands, invariants, workspace tools, projections, durable/package codecs, and optional spatial facet. |
| `PreparedCampaignChange` | Initiating coordinators and `CampaignTransaction` | Carry owner, base revision, side-effect-free owner change, and post-commit facts without exposing owner storage. |
| `CampaignTransaction` | Initiating coordinators | Revalidate, atomically apply or roll back owner changes, record result revisions and outbox entries, and enforce the commit frontier. |

Interfaces use stable typed identities, explicit absence, typed rejection
reasons, revisions, and cancellation tokens where work may be long. UI strings,
null sentinels, storage keys, render nodes, and mutable domain entities are not
boundary protocols.

## Runtime Views

### Authoring Commit

The workspace distinguishes direct gestures, immediate atomic edits, and
protected graph drafts. A direct gesture previews transiently and commits on a
valid completion; an immediate edit validates and commits without a separate
preview decision; a graph draft remains an isolated branch until explicit
accept or discard.

1. An adapter translates input into a typed operation and the workspace enters
   `loading-closure` at authored revision `R`.
2. The workspace requests the exact touched and identity closure. Missing data
   is loaded explicitly; it is never guessed.
3. Direct preview enters `preview-ready`; protected graph work enters
   `draft-ready` and preserves its intent journal and raster repair projection.
4. Cancellation before commit returns to the previous committed truth while
   preserving passive selection. Rejection or stale revision preserves the
   intent or graph draft and exposes typed repair, reload, or discard actions.
5. Commit sends the command and expected revision `R`. The Authored World and
   each actually affected owner, such as Campaign Placement, Dungeon Runtime, or
   Travel during live exploration, create side-effect-free changes for identity
   preservation, reassociation, actor relocation, and route invalidation.
6. The operation enters the non-cancellable commit section only after every
   participant is prepared. `CampaignTransaction` revalidates and commits all
   changes, one receipt, and the edit log atomically.
7. Accepted work records the receipt for undo. Touched facts invalidate derived
   generations. In-flight queries complete against their named revision; new
   owner queries can address the committed revision immediately, while derived
   views expose loading until their replacement projection is usable.
8. Undo or redo submits the receipt's semantic inverse through the same steps;
   stale inverse work is rejected without changing any owner.

### Travel Segment

1. Travel moves from `planning` to cancellable `preparing-segment` and asks the
   current Dungeon Spatial Context for route and cost facts from an explicit
   authored/runtime revision tuple.
2. Perception and source-owned event candidates are evaluated from the same
   tuple. A required GM decision is prepared for the Decision Inbox rather than
   represented only as a UI action.
3. Travel, Campaign Placement, Dungeon Runtime, Perception, Calendar, Decision
   Inbox, and any effect owners prepare changes.
4. The operation crosses the commit frontier only after preparation.
   `CampaignTransaction` commits position, heading, elapsed time, tracks,
   knowledge, interruption, pending decision, environment state, and factual
   log atomically.
5. The resulting durable journey state is `ready-to-continue`,
   `prompt-pending`, `paused`, `blocked`, `failed`, `completed`, or `aborted`,
   with its specific reason and permitted next actions.
6. Prompt delivery retries idempotently from the outbox. A delivery failure does
   not roll back the segment or lose the pending decision. Continue and abort
   address that decision explicitly.
7. Autoroute continuation always starts from the newly committed revisions.

### Actor Autonomy Step

1. The GM confirms a campaign-time boundary.
2. Autonomy enters cancellable `evaluating` and reads one shared revision tuple.
   It obtains local offers and spatial facts in bulk, bounds candidate and route
   work, and resolves reservations in a deterministic planning phase.
3. Candidate choice remains deterministic. Party danger or another GM-owned
   decision takes a separate pause branch: Autonomy prepares only its pause or
   catch-up boundary, and the Decision Inbox prepares its own entry. Their
   atomic commit leaves movement, campaign time, needs, jobs, effects, and
   random results unchanged, then ends as `paused-for-decision`.
4. When no decision blocks the action, work that cannot stay inside the
   qualified bound returns a typed
   progress-capable result rather than starting unbounded hidden work.
5. Otherwise every affected owner prepares its state change. Random input for bounded
   non-party conflict is created only at the commit frontier and is recorded in
   the same atomic result.
6. `CampaignTransaction` commits all need, job, group, reservation, movement,
   time, applicable foreign-effect, random-result, event, applicable decision,
   and log facts atomically.
7. The final state is `committed`, `paused-for-decision`, `rejected`, or
   `cancelled`. Owner rejection identifies the owner and repairable cause while
   preserving the previous confirmed campaign-time boundary.

### Catalog, Import, And Recovery Operations

- Catalog lifecycle commands expose the prepared participants, destructive
  boundary, progress, typed rejection, and final lifecycle state. Archive and
  Runtime pause are one transaction; cancellation before commit changes neither.
- Import proceeds through `staging`, `validating`, `mapping-required`,
  `ready-to-commit`, and a short atomic commit. Failure or cancellation destroys
  staging only and leaves existing Dungeons unchanged.
- Recovery exposes backup creation, restore-test, migration validation,
  publication, retry, and restore-from-backup as distinct states. No failed or
  partially validated migration becomes writable.

## Sparse Spatial And Projection Architecture

The complete Dungeon is one logical whole, but it is never a mandatory in-memory
or query workset.

- spatial truth is partitioned by stable coordinate regions and indexed by
  identity, bounds, relationship, reverse dependency, and revision
- a viewport loads the visible region plus bounded prefetch; a command loads
  the touched region plus the exact identity closure required by its invariant
- an identity appears once in a result even when it crosses several spatial
  partitions
- authored bounds are indexed metadata, not fixed map dimensions
- graph, key, routing, description, heatmap, and visibility indexes are derived
  and independently rebuildable from authoritative facts
- caches are bounded, revision-keyed, and invalidated by committed touched-fact
  and dependency keys; invalidation advances affected generations rather than
  scanning every cached result, and cache presence never changes correctness
- progressive loading distinguishes loading, usable partial projection, and
  complete requested projection
- replacement work such as hover, pointer preview, graph analysis, visibility,
  and route search carries one operation scope, deadline, and generation; it is
  cancellable, supersedable, and cannot leave an unbounded task queue

This keeps ordinary work proportional to visible or touched facts rather than
all off-screen Dungeon content.

An exact closure is a correctness boundary, not permission to hydrate the whole
Dungeon. Interactive work records its region, fact, byte, and traversal counts
against the existing latency budgets. Work estimated to exceed that class
becomes a progressive heavy operation before expensive traversal begins; it
streams bounded work units, exposes progress, remains cancellable until commit,
and never weakens invariant validation. Contracts define the qualification
budgets and typed escalation result without imposing a fixed coordinate limit on
valid authored Dungeons.

## Extensibility Model

Extensibility is compile-time capability composition, not runtime plugins.

### New Authored Object Or Tool Family

A new family encapsulates its authored fact and invariant contributions,
commands, projections, storage mapping, package mapping, and optional spatial
behavior as one vertical slice under Dungeon Authored World ownership. One
`DungeonAuthoredFamilyModule` contributes those parts through a typed
compile-time contract. A Dungeon-owned composition list is the only shared
registration point. A tool produces commands for one or more authored families
but does not modify query, storage, or render internals directly.

Every spatial family is purpose-specific. A generic Marker or Prop extension
cannot bypass ownership: authored furnishings and table-facing interactions are
Curiosities, while Encounter and Loot placements reference their external
owners.

Adding the family changes its module, its owner-defined mappings, and the one
Dungeon composition list. Stable Workspace, Query, Exchange, and durable ports
consume contributions without family-specific switches. It must not require
changes to Travel, shell composition, unrelated features, or generic persistence
mechanisms unless it deliberately publishes a new spatial capability.

### Travel, Time, Or Event Rule Change

Movement calculations use explicitly versioned rule profiles behind Travel
policies. Calendar owns time advancement; each event source owns its candidate
rule; the Decision Inbox owns only a resulting pending GM decision. A rule
change replaces or adds a profile at the owner of its result plus its proof
data. Dungeon continues to publish neutral geometry, terrain, Passage, and event
facts. Presentation and persistence consume the same versioned result rather
than duplicating rules.

### UI Or Persistence Adapter Replacement

UI adapters depend only on capability commands and projections. Persistence
adapters implement owner-defined durable ports and package codecs. Neither
adapter contains business validation, identity allocation policy, reassociation
rules, travel decisions, or projection ownership. Replacing an adapter therefore
does not change capability behavior or unrelated features.

Replacing one owner adapter changes only that adapter and its focused proof.
Replacing the persistence technology for all Dungeon capabilities changes the
owner-adapter suite and the common transaction adapter, but no business
capability, shell contract, or unrelated feature.

## Quality Architecture

| Scenario | Architectural response | Measure from requirements |
| --- | --- | --- |
| Open a 100,000-cell sparse Dungeon | Indexed bounded viewport, progressive projection, no whole-Dungeon hydration | First usable viewport and context under 2 seconds p95 |
| Pan or hover | Adapter-local input, bounded visible projection, replaceable work | 16 ms p95 |
| Preview local edit | Measured immutable local closure, typed escalation before heavy traversal, no persistence round trip after closure load | 50 ms p95 |
| Commit ordinary edit | Exact touched closure, optimistic revision, prepared change and short atomic apply | 500 ms p95 |
| Run heavy route, graph, or batch preview | Background work with progress, cancellation, and independent query lanes | Progress within 100 ms; cancellable above 2 seconds |
| Update passive player view | Deny-by-default audience projection, shared perception revision, generation invalidation | 100 ms p95 |
| Advance 200 autonomous actors | Shared snapshot, bulk local candidates, bounded routes, deterministic reservations, prepared atomic step | 2 seconds p95; progress within 100 ms |
| Crash or failed migration | Atomic durable transaction, pre-mutation restore-tested backup, read-only failure mode | Wholly old or wholly new state; original and backup preserved |
| Import malformed or oversized package | Untrusted staging, structural and resource gate, cancellable validation before domain materialization | Typed rejection; no Catalog, authored, runtime, or recovery mutation |

Long-running work never owns the UI thread. Commands and query results expose
loading, success, typed rejection, cancellation, and failure distinctly.
Diagnostics record operation identity, duration, revision, affected counts, and
failure category without copying authored content or secrets.

Preparation and projection run against immutable committed snapshots outside the
write transaction. Reads remain available on the previous committed revisions
while a prepared change is applied. Qualification records total duration,
write-transaction duration, stale retry rate, closure and invalidation counts,
queue depth, and concurrent read latency; the transaction design is acceptable
only while the existing viewport and player-output budgets remain green under
concurrent commits.

Workspace snapshots, protected graph drafts, and at least 200 ordinary undo
receipts use encoded patches or copy-on-write state rather than full-Dungeon
copies. Their shared retained-memory budget and large-operation classification
belong to the editor contract and are verified together with frame latency.

## Persistence, Versioning, And Recovery

Each capability owns its durable logical schema and migrations. One local
transaction mechanism supports atomic prepared changes across owners without
letting one owner read or write another owner's records directly.

The mechanism revalidates owner revisions and invariants inside the transaction,
applies only owner-defined changes, and stores result revisions plus outbox
entries in the same commit. It does not perform routing, perception, projection,
package parsing, or other unbounded work while the write transaction is held.

Authored and runtime roots have independent versions. An authored package has a
portable format version independent of internal storage version. Rule profiles,
generated projections, and logs record the version needed to explain their
result.

Before migration, the recovery capability creates and restore-tests a backup.
Migration builds and validates the new state before making it writable. Failure
keeps the old state and backup intact and exposes diagnostics, retry, and
restore from backup. Rolling and manual backup retention is policy-driven rather
than embedded in feature adapters.

The durable factual log is append-only from the user's perspective. Corrections
append explicit overrides or correction facts; they do not rewrite historical
travel or autonomy results. Editor undo is a separate session facility and is
not part of that log or portable packages.

## Dependency Rules

- business capabilities may depend only on other capabilities' published
  contracts, never their domain objects, adapters, or storage
- presentation and storage depend inward on capability ports
- Dungeon Spatial Context may read Dungeon owners but never Travel, Campaign
  Placement, Perception, or Autonomy internals
- Travel, Perception, and Autonomy may consume Dungeon Spatial Context without
  taking ownership of Dungeon facts
- an initiating capability's coordinator may depend on participating published
  contracts and `CampaignTransaction`, but never feature-specific storage
- `CampaignTransaction` depends only on prepared-change and durable transaction
  contracts, never feature business types
- player display and visibility-filtered export depend on
  `DungeonAudienceQuery`, never unrestricted `DungeonQuery`
- Exchange may produce owner-prepared import changes only after its untrusted
  package gate succeeds; package data never selects Recovery artifacts
- derived projections depend on committed owner facts; owners never depend on
  projections
- adapters may share feature-neutral execution, transaction, rendering,
  diagnostics, and backup mechanisms, but those mechanisms own no Dungeon
  meaning

## Decisions And Alternatives

### One local capability-modular application

Chosen to support one operator, local data, low latency, and atomic multi-owner
steps. Distributed services were rejected because no confirmed need offsets
their partial-failure and synchronization cost.

### Partitioned authored world rather than one hydrated aggregate

Chosen because correctness needs one logical Dungeon while performance requires
bounded work. A mandatory whole-Dungeon aggregate was rejected because local
work would scale with all 100,000 cells. Independent region owners were rejected
because cross-region identity and geometry would lose one consistency owner.

### Prepared atomic changes rather than sagas

Chosen for travel, live editing, links, and autonomy because their requirements
forbid partially committed owner state. Eventual compensation was rejected as
observable corruption for position/time, geometry/relocation, or conflict
effects.

Preparation is side-effect-free and may be long-running. Owner revalidation,
apply, result revisions, and outbox insertion share one short durable
transaction. A single central business coordinator was rejected because each
new operation family would otherwise change that coordinator; the initiating
capability owns orchestration instead.

### Authoritative state plus audit journal rather than full event sourcing

Chosen because the product needs current durable truth, explicit logs, editor
undo, and recovery but does not require replaying every historical command to
construct normal reads. Full event sourcing remains possible later but is not
required and would increase migration and projection complexity.

### Shared project capabilities for Travel and Perception

Chosen because Dungeon, Hex, actor autonomy, and player output need one travel
context and one perception truth. Duplicating those decisions inside every
spatial feature was rejected. Dungeon retains its geometry and environment
semantics through the Spatial Context interface.

### Typed compile-time extensions rather than generic plugins

Chosen because local source change is the stated extensibility need. A generic
runtime plugin platform was rejected as unneeded complexity and a weaker type,
migration, and recovery boundary.

### Derived multi-view projections rather than view-owned models

Chosen so raster, graph, key, travel, export, and player output remain coherent.
Allowing each view to persist its own Room, connection, or passability model was
rejected because synchronization would become a business workflow and produce
multiple truths.

### Explicit audience declassification rather than adapter filtering

Chosen because the player display and visibility-filtered exports must be
incapable of receiving GM-only truth. Filtering inside a renderer or generic
query consumer was rejected because omission would remain optional and one
adapter mistake could reveal authored secrets.

### Separate Catalog, Exchange, Recovery, And Decision Ownership

Catalog owns Dungeon lifecycle, Exchange owns package and document transfer,
Recovery owns backup and migration operations, and the Decision Inbox owns
durable pending GM decisions. One combined convenience capability was rejected
because archive, import, restore-from-trash, restore-from-backup, prompt
delivery, and destruction have distinct state, trust, and consistency
boundaries.

## Verification And Acceptance

While this document is `Draft`, its rules are review-owned and must not be
described as mechanically enforced by the current implementation. Acceptance of
this target requires:

- every active requirement capability is assigned to an owner or explicitly
  identified as presentation-only
- every stateful area has one owner, explicit mutation path, consistency
  boundary, and derived consumers
- authoring, travel, autonomy, Catalog, import, and recovery runtime views cover
  loading, progress, cancellation, commit frontier, rejection, failure, repair,
  and preserved-state boundaries relevant to that operation
- every cross-owner operation names its initiating coordinator, prepared
  participants, in-transaction revalidation, durable result, and outbox behavior
- live authoring and undo use the same atomic owner set, and one resolved spatial
  binding can never expose both authored and runtime current positions
- each measurable quality need maps to an architectural response and a future
  production-route proof
- the three extensibility scenarios remain local by the dependency rules above
- player output and filtered export cannot consume unrestricted Dungeon facts;
  malformed or oversized packages cannot reach domain or recovery mutation
- no target decision relies only on a current class, package, adapter, storage
  schema, or migration artifact

After owner acceptance the status becomes `Active`. Result 3 may then judge the
pre-refactor and final implementations against this target. Mechanical rules and
production-route tests are introduced only as part of a later accepted delivery
plan; green checks on the current code are not evidence that this target is
already implemented.

## References

- [Dungeon Feature Requirements](../requirements/requirements-dungeon.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Travel Requirements](../requirements/requirements-dungeon-travel.md)
- [Dungeon Travel State Requirements](../requirements/requirements-dungeon-travel-state.md)
- [Actor Autonomy Requirements](../../autonomy/requirements/requirements-actor-autonomy.md)
- [Shared Reise State Requirements](../../project/requirements/requirements-travel-state-tab.md)
- [Accepted Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
