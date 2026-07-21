Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-22
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
- one normal Encounter-outcome confirmation that atomically completes the
  Encounter, awards Party XP, applies selected World-runtime consequences, and
  records the result
- authoritative Party membership with visible retryable reconciliation into
  affected running Scenes and their Encounters
- an immutable explanatory campaign history without whole-campaign replay or
  historical restore
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

### Cohesive Live Campaign Root

One partitioned `LiveCampaignRoot` is the physical commit authority for the
complete invariant closure of confirmed live-campaign operations. Semantic
ownership remains with capabilities: each owner defines its partition state,
invariants, reducer, query language, codec, migration, and factual history. The
root owns only the manifest, monotonic campaign revision, touched-partition
commit, operation index, receipts, snapshot leases, and atomic publication.

The root contains exactly:

- complete committed Dungeon Catalog, Authored World, and Dungeon Runtime truth
  for every live-traversable Dungeon; Hex or a future CityMap joins under the
  same rule while retaining its own identity and spatial semantics
- Campaign Placement, Travel commit state, Campaign Clock, Perception and
  Knowledge, Campaign Decisions, and Actor Autonomy
- complete owner-typed Actor Condition, Resource, Possession, and World Runtime
  partitions needed by confirmed Autonomy or Encounter consequences
- `PartyCampaign`: character identity/profile, active/reserve membership,
  XP/level/rest, combat profile, and GM-control state as one Party invariant
  closure; current spatial position exists only in Campaign Placement
- materialized Encounter Runtime, with every running Encounter keyed to exactly
  one running Scene: builder, initiative, combatants, HP/round/turn, result,
  applied Scene-context stamp, completion, and effect receipts
- operation-correlated factual history and correction facts that must be
  old-or-new with the initiating campaign operation

The root explicitly excludes Running Scene truth, Session Planner and Session
Generation state, prepared artifacts, saved Encounter plans/templates, Catalog
reference corpora, Creatures, Items, Encounter Tables, authored World
definitions, executable immutable rule artifacts, UI interaction state, and all
rebuildable projections or caches. Restart relevance alone is not an admission
rule. A new partition is admitted only when a confirmed user operation requires
its complete invariant closure to change old-or-new with existing root truth;
the former canonical write path is removed in the same migration.

Scene remains an independent root because its accepted behavior deliberately
allows a valid Scene or Party change to remain usable while Encounter context is
visibly pending. Scene owns the desired context stamp and reconciliation intent;
Encounter Runtime owns the applied stamp. Their composite read is synchronized
only when those exact stamps match. This saga is specific to Scene and must not
be generalized into the campaign commit model.

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
before mutation. A root partition may change only through its owner reducer; an
external capability may change only through an explicit destination-owned
command.

## Capability Context

### Figure 1: Logical capability context

Arrows mean “uses the published capability of”. Named capability boxes are
business owners; the transaction mechanism owns no business state.
Presentation and storage adapters are outside the ownership boxes.

```text
Adapters --commands/queries--> [Semantic capabilities]
Adapters --queries-----------> [Query Projections]
Adapters --commands----------> [Exchange] + [Recovery]

[Authoring Workspace] --phase program--> [Live Campaign Root]
[Travel] -------------> [Live Campaign Root]
[Actor Autonomy] -----> [Live Campaign Root]
[Encounter Runtime] --> [Live Campaign Root]
[Party Campaign] -----> [Live Campaign Root]

[Live Campaign Root] --typed partitions--> [Dungeon Authored + Runtime]
[Live Campaign Root] --typed partitions--> [Placement + Travel + Clock]
[Live Campaign Root] --typed partitions--> [Perception + Decisions + Autonomy]
[Live Campaign Root] --typed partitions--> [Party + Encounter + World Runtime]
[Live Campaign Root] --snapshot/change set--> [Query Projections]

[Running Scene] --desired context/reconcile--> [Encounter Runtime]
[Planning + Reference roots] --stamped immutable input--> [Semantic capabilities]
[Recovery] --runs--> owner-defined partition migrations
```

This diagram is logical. The root is a business commit authority, not a source
folder or generic platform service. Capability owners remain visible in source
and contracts even though their admitted live partitions share one durable root
manifest.

## Capability Ownership

### Dungeon Catalog

Owns Dungeon identity, name, archive/trash lifecycle, duplication request, and
the association between a catalog entry and its authored and runtime roots. It
does not own geometry, runtime positions, or external campaign objects.

`DungeonCatalog` is the only public command entry for creation, rename, archive,
unarchive, restore-from-trash, trash, final destruction, and duplication. It
records the trash-entry time, lifecycle revision, and policy-derived destruction
eligibility; the retention duration remains requirements truth rather than an
architecture constant. Creation commits Catalog identity, the Authored root, and
the required Runtime root atomically. Archive changes Catalog lifecycle state
and pauses active Dungeon Runtime atomically while preserving links and runtime
state. Duplication asks the Authored World to prepare new authored identities
and rewritten internal references, preserves external references, omits runtime
and history, then commits the new Catalog and authored roots together. Exchange
and Recovery do not own Catalog lifecycle commands; Recovery exposes a distinct
restore-from-backup operation.

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

Every successful undoable authored commit returns a `CampaignCommitReceipt`
with the affected partition generations and one opaque inverse token per
undoable owner partition. The workspace stores receipts rather than snapshots and
never interprets an owner's token. Undo and redo submit those tokens through the
same owner boundaries as the original change; a stale or conflicting inverse is
rejected with repair choices and never partially applied. A new accepted commit
after undo discards the workspace's redo branch. When a command outcome is
unknown after a transport or process failure, the workspace resolves the
operation identity before preparing or submitting another mutation.

### Dungeon Runtime Context

Owns durable Dungeon-local exploration facts that must not enter a portable
authored package:

- current Passage, light, sound, mechanism, Trap charge, and reset state
- physical tracks and transient or persistent Dungeon environmental events
- active exploration context, environment/runtime factual entries, and runtime
  archive/pause state
- the authored revision against which current routes and visibility were
  validated

Authored configuration supplies defaults and legal operations. Runtime state
records the current campaign instance. Editing authored geometry during
exploration may propose runtime relocations or invalidations, but only an atomic
campaign commit may publish both results.

Dungeon Runtime is also the only command owner for adding, correcting,
suppressing, or otherwise changing physical tracks. Perception owns what an
actor or group knows about those tracks; Travel owns a pursuit that follows a
selected track. No one of those capabilities writes another's state directly.

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

At application composition, Dungeon Spatial Context implements the Dungeon
provider's Travel-owned routing facet and Campaign Placement-owned anchor
validation facet. Dungeon query/adapters separately implement bounded summary
and position-codec facets. No consumer receives the combined provider bundle.

### Dungeon Query Projections

Produces revisioned, immutable projections for raster, graph, Dungeon Key,
detail, diagnostics, document output, and player visibility. Projections that
show movable actors join a bounded Campaign Placement projection with authored,
runtime, and Perception facts. A query first captures one immutable
`CampaignRootSnapshot` containing a monotonic campaign revision and every
partition generation needed for that query, then bulk-reads bounded owner slices
against that vector. A source-specific projection omits only owners it does not
read. Reusable subprojections are keyed by owner revision and touched keys. Late
work is coalesced toward the newest publishable vector and cannot replace a
newer result or starve publication indefinitely.

A specialized view may aggregate or omit facts, but it cannot invent a second
Room, connection, passability, description, knowledge, or selection identity.
Every view addresses the same stable references.

Player display and visibility-filtered export consume only an audience-specific
projection contract. `DungeonAudienceQuery` combines authored, runtime,
Campaign Placement, Perception, a revisioned `PartyAudienceContext`, a
revisioned `TravelActiveContext`, a revisioned presentation input, and an
explicit audience profile with deny-by-default filtering. `PartyCampaign`
supplies the active Party identity and complete member set. Travel supplies the
active exploration actor/group identity; the query validates that focus against
current Party membership and Campaign Placement. Presentation state cannot
invent or cache either authority. The closed player-audience result type cannot contain GM-only prose,
private discovery notes, hidden references, diagnostics, or unrestricted
authored objects; a GM-document profile uses a distinct result type rather than
optional player fields.

An adapter-local `PlayerPresentationSession` owns player-camera offset and
revisioned temporary reveal or hide instructions. Its follow target is derived
from `TravelActiveContext`; autonomous movement cannot select another focus. The
session is interaction state, not a business capability, and cannot change
Party membership, active exploration focus, or Perception knowledge.

`DungeonAudienceQuery` derives one monotonic `AudienceAuthorizationGeneration`
from the complete authored, runtime, placement, Perception, Party, audience
profile, Travel-active-context, and presentation revision tuple. Any source change invalidates the
previous player DTO at the sink before replacement work starts; this covers
visibility reduction, Party change, forced-unknown knowledge, movement, and
temporary hide through one barrier. Loading, cancellation, or projection
failure displays only a DTO from the current generation and otherwise fails
closed.

### Dungeon Exchange

Owns versioned authored-package import/export, human-readable document export,
and the import-plan lifecycle. It owns no Catalog lifecycle or duplication
command.

- portable packages contain authored truth and external references only
- human-readable export consumes audience projections and a visibility profile
- import first creates a conflict-resolution plan bound to one validated staged
  snapshot, then commits all accepted identity and reference mappings atomically
- export renders privately, remains cancellable before publication, and makes
  one complete artifact visible atomically

Imported bytes remain untrusted until an exchange-owned gate has staged them,
validated their allowed format and structure, bounded their resource demand,
and represented external references as import-scoped tokens. Package-provided
paths or identifiers never become local filesystem paths or foreign owner
identities directly. Only a fully validated, GM-resolved import plan may prepare
Catalog and Authored World changes. A plan carries the staged content identity,
its own revision, and the destination-owner revisions against which mappings
were resolved. Commit revalidates those bindings and consumes the plan at most
once under the durable operation identity. Retryable I/O, commit, or
stale-revision failure preserves a validated plan and offers retry, rebase or
remap, and discard; an unsafe-format or resource-gate rejection terminates or
quarantines its staging.

An export receives an opaque, operation-scoped destination authority created by
the GM-selected export boundary. Authored names are presentation names only and
never select a filesystem target. Generation uses quota-bounded private staging,
revalidates audience and visibility inputs before publication, and atomically
publishes or leaves both the destination and any previous artifact unchanged.
Exact codec, archive, validation-error, destination, and resource-limit shapes
belong to the package contract.

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
round configuration, movement overrides, interruption state, the active
exploration actor/group focus, and factual travel entries. The current provider
bundle supplies provider-specific anchors, route, cost, arrival, and readback
facts through separate owner-facing facets.

The full navigable Dungeon travel-control workspace is `Reisen` and uses this
capability. Travel publishes exactly one global compact `Reise` contribution.
Its `TravelCompactContextQuery` resolves the current provider from the active
Party's revisioned Campaign Placement and returns either explicit `NoContext` or
an approved-provider readback through `SpatialSummaryFacet`. Its result
generation contains active Party identity/revision, selected Party-placement
revision, provider identity and kind, and provider-source revision. Only the
newest Party-placement generation may publish; absent, unresolved, unsupported,
or stale provider input returns or retains `NoContext`, never a previous
provider's readback. The query remains command-free and does not become another
command owner.

### Perception And Knowledge

Perception is a project capability shared by travel, the passive player view,
and actor autonomy. It owns directional actor/group knowledge, active-check
overrides, discovery confirmation, and track-knowledge state. Dungeon supplies
3D geometry, light, cover, sound, senses-relevant environment, and physical
tracks; actor owners supply senses and actor facts.

The same committed perception result feeds GM notification, route interruption,
autonomy, Fog of War, and player output. No presentation adapter recomputes a
private visibility truth.

Its public commands set or clear an active check, confirm discovery, force known
or unknown, request reevaluation, and prepare track-discovery changes. A search
binds the selected physical-track identity and Runtime revision before
Perception prepares knowledge. Party detection coordinates Perception, Travel,
affected Autonomy state, and the Decision Inbox so route and behavior pause in
the same commit that makes the decision pending.

### Campaign Decision Inbox

The project-wide Decision Inbox owns durable pending GM decisions, semantic
`presented` acknowledgement, explicit current GM resolution/choice, the logical
delivery requirement, and the continuation or abort reference for the
initiating operation. The Outbox mechanism owns technical delivery attempts and
delivery state. Presentation records `presented` idempotently only after the
prompt is actually usable; derived factual views may then report that it opened. Event
definitions and candidate production remain with their source owners; the Inbox
does not decide fictional outcomes.

Travel interruption and its pending decision commit together. Presentation
reads a durable outbox and may retry delivery idempotently, so a crash or UI
failure after the business commit cannot lose or duplicate the decision.
Continue binds the current decision revision, semantic `presented`
acknowledgement, explicit GM resolution, and continuation choice into one
Inbox-owned transition precondition. It atomically consumes that authority and
cannot replay its continuation. Missing, stale, mismatched, or already consumed
authority fails closed. Decision-bound abort consumes the same current
`presented` acknowledgement and decision revision with an explicit GM abort
choice. Delivery failure alone cannot abort or continue. Ordinary journey
cancellation before a pending decision is a separate Travel command and does
not consume Decision Inbox state.

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

Autonomy owns a revisioned set of enabled campaign contexts. For each elapsed
interval it stores deduplicated immutable `CatchUpEvidenceSegment` records by
changed owner/provider scope, binding the applicable rule profiles and compact
input facts needed to evaluate that interval as it originally occurred. The
segments are historical evaluation evidence, not another owner of current
truth, and may be shared by every relevant context. Each inactive context keeps
only a compact `CatchUpCheckpoint` with its last processed boundary and cursor;
decision-free prefixes may be compacted, while evidence referenced by a pending
decision remains pinned. Continue resumes from the exact pinned evidence and
cursor. Abort preserves the paused checkpoint and permits later resume, bound
adjustment, or disable without silently advancing time. Missing, expired, or
unreadable evidence produces a typed blocked/repair state, never substitution
with current truth. Retained bytes, intervals, compaction, and expiry are bounded
by the Autonomy contract.

### Party Campaign

Party remains the semantic owner of character identity/profile, membership,
progression, rest, combat profile, and GM-control rules. Those facts form one
owner-typed `PartyCampaign` partition inside the Live Campaign Root because a
normal confirmed Encounter outcome must update XP and completion atomically and
Party progression validation depends on the complete Party invariant closure.
Campaign Placement alone owns current spatial position and movement groups; no
Party partition or adapter retains a second current travel location.

An accepted Party activation, deactivation, or deletion commits Party truth,
its campaign-history fact, and a non-mutating membership-change publication
immediately. It never waits for or enumerates Scene inside the root commit. The
Scene-owned reconciliation flow compares referenced members with the exact
Party revision, persists retry intent only for affected running Scenes, and
reconciles any Encounter belonging to them. Initialization and refresh perform
the same comparison, so unavailable delivery cannot lose the work. Newly active
characters remain unassigned. An inactive or deleted character is excluded
immediately from audience, threshold, XP, and other current-Party reads even if
Scene or Encounter reconciliation is pending.

### Encounter Runtime And Outcome

Encounter owns materialized runtime state inside the root, and every runtime is
keyed to exactly one Running Scene. Saved plans, generated batches before
materialization, and reference inputs stay outside under their independent
planning/artifact lifecycles.

`ConfirmEncounterOutcome` is one Encounter-owned phase program. It validates the
current runtime result, eligible Party members, calculated XP, selected named-NPC
and finite-stock consequences, and their exact source bindings. One root commit
then marks that Encounter outcome completed, advances the complete Party
progression, applies `WorldRuntime`, stores effect receipts, and appends the
correlated campaign-history facts. Any rejection changes none of them. Retry of
the same operation identity and intent fingerprint returns the stored terminal
result; a different fingerprint conflicts. The associated Running Scene is not
closed or mutated.

### World Runtime And External Definitions

`WorldRuntime` contains stable definition IDs, NPC lifecycle, actually consumed
finite stock, and other confirmed live quantities that participate in Encounter
or Autonomy operations. World Planner remains the semantic owner, but authored
profiles, factions, locations, links, disposition, notes, and declared capacity
stay in a versioned external definition root. Root operations bind the exact
definition revision used as immutable input and never copy those definitions.

### Running Scene Reconciliation

Scene owns Running Scene identity, composition, focus, notes, semantic World
location, provenance, desired Encounter-context stamp, and durable reconcile
intent outside the Live Campaign Root. Encounter Runtime owns its applied stamp.

Scene save is authoritative before Encounter synchronization. A technical or
business reconciliation failure preserves the valid Scene, marks its exact
desired revision `pending`, and retries initialization, refresh, or explicit
retry. A Party membership change follows the same dependent-context rule: Party
commits first, then only affected Scenes and Encounters reconcile. Stale context
is never presented as synchronized or used as current Party truth.

### Campaign History

Each admitted partition emits owner-typed factual entries as part of the same
root operation that creates the fact. The derived chronological view includes
confirmed time, travel, Encounter outcome, XP, membership, World/runtime effects,
and GM corrections. Entries retain operation identity, applicable campaign-time
boundary, stable references, and historical display facts needed after rename or
deletion. Corrections append linked facts; nothing rewrites history.

The history is not the current-state write model and cannot reconstruct or
restore an arbitrary historical whole-campaign snapshot. Technical diagnostics,
editor undo, Scene notes, drafts, and UI interaction remain separate.

### Use-Case Coordination And Campaign Root Commits

The capability that accepts an initiating command owns a typed, stateless phase
program for atomic changes whose invariants span root partitions:

- live authoring plus required actor relocation and route invalidation
- one completed travel segment plus position and campaign time
- one autonomy time step plus needs, jobs, movement, reservations, effects,
  random conflict results, and events
- one Encounter outcome plus completion, Party progression, World Runtime, and
  campaign-history facts
- paired cross-Dungeon Passage links

Authoring coordinates live-edit and undo, Travel coordinates segments, Actor
Autonomy coordinates autonomy steps, Encounter coordinates outcome
confirmation, Catalog coordinates lifecycle changes, and Authored World
coordinates paired links. There is no central business switch or workflow
registry that changes for every operation family.

Every durable initiating command has a stable operation identity and intent
fingerprint. Its `CampaignPhaseProgram` declares a static `ReadSet`, `WriteSet`,
`InvariantSet`, and optional `DeclassificationSet`. It reads one immutable root
snapshot plus explicitly stamped external inputs, runs bounded pure phases, and
folds owner-typed reducers over one private candidate root. A phase may consume
typed prospective facts produced by an earlier phase, but cannot call storage,
UI, an owner callback, or an external mutating API. Cyclic dependencies,
undeclared reads, and a missing partition reject before mutation.

The prepared candidate carries the expected root revision, exact partition
generations and range/negative-read evidence, touched keys, owner-typed factual
entries, and optional owner-opaque inverse tokens. `CampaignRootCommit` rechecks
the operation fingerprint and declared read evidence inside one short local
transaction. It writes only touched owner partitions, a new root manifest and
revision, terminal operation outcome, receipt, history batch, and outbox. It
never hydrates every partition or decodes an uninvolved owner's bytes.
Long-running routing, perception, simulation, projection, migration, backup,
and dependency discovery never occurs while the writer frontier is held.

The `CampaignCommitReceipt` identifies the operation, read/write partitions,
base and result revisions, and owner-opaque inverse tokens. The outbox
contains owner-defined facts and non-mutating notification/publication
deliveries plus delivery state; it is not an undo receipt and cannot invoke a
business-owner mutation. Any effectful integration must instead use the normal
idempotent destination command after commit. Repeating an operation identity
with the same fingerprint returns its stored terminal outcome; reuse with a
different fingerprint conflicts. No projection publishes before commit.
Cancellation is guaranteed until the short writer section; stale input,
rejection, or cancellation before that frontier applies no change.

Calendar is the only campaign-time owner. It first publishes a non-mutating
`CalendarIntervalProposal`. Autonomy evaluates that exact interval and returns
`AutonomyCoverageEvidence` bound to the enabled-context-set generation, active
context, and shared interval-evidence segments. The time phase depends on that
evidence, so Calendar rejects stale or incomplete coverage
without enumerating or rewriting every inactive context on each advance. When
Travel advances time, its phase program also folds the active-context Autonomy
step. A separate operation cannot advance the same boundary again. A non-Travel
time command follows the same rule under its own initiating capability.

## State Ownership And Consistency

| State | Owner | Mutation path | Consistency boundary | Derived consumers |
| --- | --- | --- | --- | --- |
| Root manifest, campaign revision, operation index, leases | Live Campaign Root | Root commit and bounded maintenance | One manifest publication over touched partitions | All root queries and commits |
| Dungeon identity, name, and lifecycle eligibility | Dungeon Catalog partition | Catalog create, rename, or lifecycle phase program | Root commit with required Runtime or Authored partitions | Catalog, links, runtime entry |
| Dungeon geometry and semantic content | Dungeon Authored World partitions | Validated authored phase program | One root commit may cover one or several linked Dungeons | Raster, graph, key, route, export |
| Authored edit factual entries | Dungeon Authored World | Accepted authored change in the same operation | Owner-local append correlated by operation identity | Derived campaign timeline and diagnostics |
| Portable external placement identity and start anchor | Dungeon Authored World | Validated placement authoring | Authored commit or activation with Campaign Placement | Export, duplication, resolved binding |
| Authoring preview and graph draft | Dungeon Authoring Workspace | Tool or graph intent | One transient workspace at a base revision | Authoring adapters only |
| Editor undo/redo | Dungeon Authoring Workspace | Commit receipt submitted as inverse phase program | Current editor session plus every touched root partition | Authoring controls |
| Workspace memory/spill accounting | Dungeon Authoring Workspace | Admission, spill, eviction, and cleanup | One hard session envelope with protected minima | Authoring controls and diagnostics |
| Environment and Dungeon-local exploration | Dungeon Runtime partition | Runtime phase or initiating campaign operation | One root commit | Travel, perception, player output |
| Physical tracks | Dungeon Runtime Context | Runtime track command or prepared movement result | Initiating Runtime, Travel, or autonomy operation | Perception search, pursuit, diagnostics |
| Movable actor, group, or object position and heading | Campaign Placement partition | Placement phase, activation, or initiating operation | One root commit | Dungeon context, travel, perception, autonomy |
| Administrative placement factual entries | Campaign Placement | Accepted placement change in the same operation | Owner-local append correlated by operation identity | Derived campaign timeline and diagnostics |
| Journey, route, pursuit, movement overrides | Project Travel | Travel intent | One completed route segment | Travel workspace and compact context |
| Exploration-round and Travel session configuration | Project Travel | Revisioned Travel configuration command | One Travel session revision | Travel planning, timing, and controls |
| Active exploration actor/group focus | Project Travel | Travel initiative/control command | Travel revision validated against Party membership and Placement | Player follow target and Travel controls |
| Compact global travel context | Project Travel | Rebuild from Party, Placement, and approved-provider revisions | One monotonic Party-placement selection generation | Global command-free `Reise` contribution |
| Campaign time | Campaign Clock partition | Time phase | One root commit with Autonomy coverage bound to the enabled-context-set generation | Travel, events, autonomy |
| Directional knowledge and discovery | Perception And Knowledge | Perception evaluation or GM override | One perception/campaign step | GM context, autonomy, Fog |
| Perception override factual entries | Perception And Knowledge | Accepted override or correction in the same operation | Owner-local append correlated by operation identity | Derived campaign timeline and diagnostics |
| Pending GM decision, presentation acknowledgement, and continuation authority | Campaign Decision Inbox | Prepared decision, idempotent presentation, or explicit current GM resolution | Initiating operation plus durable outbox and one terminal consume | Travel, autonomy, GM controls, opened-prompt log view |
| Needs, jobs, reservations, catch-up evidence, and checkpoints | Actor Autonomy partitions | Confirmed campaign-time phase program or GM command | One root commit | Autonomy controls and summaries |
| Autonomy qualification envelope | Actor Autonomy | Owner-approved conformance configuration | One versioned workload class | Admission and qualification proof |
| Party identity/profile, membership, progression, rest, combat profile, GM control | Party Campaign partition | Party command or Encounter-outcome phase program | One root commit; placement excluded | Party UI, Encounter, audience, Travel |
| Materialized Encounter builder, combat, result, completion, applied Scene stamp | Encounter Runtime partition | Encounter command, Scene reconcile, or outcome phase program | One root commit; every runtime has exactly one Running Scene key | Encounter UI and Scene sync readback |
| NPC lifecycle, consumed finite stock, other confirmed live World quantities | World Runtime partition | Encounter, Autonomy, or GM phase program | One root commit | Encounter sources, World views, campaign history |
| Running Scene desired composition, focus, notes, location, reconcile intent | Scene external root | Scene command then specific reconcile saga | One Scene save; Encounter applied stamp may remain pending | Scene UI and Encounter context |
| Saved plans, planning, reference corpora, authored World definitions, rule artifacts | Owning external root | Owner command or stamped immutable input | Owner-defined; never a root-commit mutation | Planning, generation, materialization |
| Meaningful campaign factual entries and corrections | Owning root partition | Same phase program as the fact | Same root commit as current-state consequence | Chronological campaign history |
| Import plan and untrusted staging | Dungeon Exchange | Package gate and GM mapping intent bound to staged content | One validated, single-consumption import operation | Import UI and prepared Catalog/Authored changes |
| Export staging and destination authority | Dungeon Exchange | GM-authorized export operation | Private generation plus atomic publication | Export UI and destination adapter |
| Backup, migration, and backup-restore operation | Dungeon Recovery | Recovery command against owner migrations | One recovery operation before writable publication | Recovery UI and diagnostics |
| Viewports, graph, key, descriptions, diagnostics | Dungeon Query Projections | Rebuild from one campaign root snapshot | Immutable campaign-revision/partition-generation vector | GM UI and unrestricted exports |
| Active Party identity and complete member set | Party Campaign partition | Party phase program | One root partition generation and audience context | `DungeonAudienceQuery`, player focus, union knowledge |
| Player camera offset and temporary reveal/hide | Player presentation adapter | Presentation-session intent | One monotonic presentation revision, fail closed | `DungeonAudienceQuery` |
| Audience-filtered player and export output | Dungeon Query Projections | Rebuild through `DungeonAudienceQuery` | One authorization generation over the complete source tuple | Player display and filtered export |
| Progressive operation frontier and snapshot lease | Initiating capability | Start, resume, cancel, complete, or expire | One bounded operation and source revision vector | Progress UI and retained-revision cleanup |
| Durable operation outcome and receipt | Live Campaign Root | Stable operation identity and intent fingerprint | Same root commit as every touched partition | Retry resolution, undo journal, diagnostics |
| Outbox delivery state | Live Campaign Root mechanism | Atomic enqueue and idempotent delivery transition | Same root commit as the originating operation | Notification and publication adapters |

No API allows a consumer to update another capability's partition or external
storage directly. Cross-owner root invariants use an initiator-owned typed phase
program, declared dependency closure, and owner reducers over one candidate root;
they never use compensating root writes, commit-time callbacks, generic payloads,
or a central business coordinator.

## Public Capability Interfaces

The names below are semantic interface families, not required code type names.
Detailed payloads, validation, compatibility, and error shapes belong in
contract specifications after this target is accepted.

| Interface | Consumers | Required behavior |
| --- | --- | --- |
| `DungeonCatalog` | Catalog and lifecycle UI | Create and rename Dungeons; read identity, lifecycle, and destruction eligibility; coordinate lifecycle and duplication through owner-prepared changes. |
| `DungeonAuthoring` | Raster, graph, key, batch, import | Preview and commit typed intents against expected revisions; return accepted facts or typed rejection. |
| `DungeonWorkspace` | Authoring adapters | Maintain selection, drafts, protected graph work, commit receipts, undo, redo, and conflict repair without owning authored truth. |
| `WorkspaceResourceEnvelope` | Dungeon Workspace and editor storage adapter | Enforce one aggregate memory/spill ceiling with protected-draft and minimum-undo reserves plus bounded cleanup. |
| `DungeonQuery` | GM Dungeon views and GM-authorized full document export | Serve bounded immutable projections with stable identities and source revisions. |
| `DungeonAudienceQuery` | Player display and visibility-filtered export | Produce deny-by-default audience DTOs from explicit authored, runtime, placement, perception, Party, Travel-focus, presentation, and audience revisions. |
| `CampaignRootSnapshot` | Phase programs and query projections | Capture one campaign revision plus immutable partition generations for coherent bounded reads. |
| `AudienceAuthorizationGeneration` | Audience query and player sink | Invalidate all older audience DTOs synchronously whenever any authorization input revision changes. |
| `PartyCampaign` | Party UI, Encounter, Travel, audience query | Own Party commands and typed snapshots while reducing its complete invariant closure only through root commits. |
| `PartyAudienceContext` | `DungeonAudienceQuery` and player presentation | Publish active Party identity and complete membership with a Party partition generation; expose no presentation authority. |
| `DungeonSpatialContext` | Travel, perception, autonomy | Provide route, cost, arrival, visibility, environment, track, and local job-offer facts without foreign business decisions. |
| `DungeonRuntime` | Travel, perception, GM controls, initiating coordinators | Read runtime context and prepare explicit environment, event, and physical-track mutations or overrides. |
| `CampaignPlacement` | Authoring, Travel, spatial providers, perception, autonomy | Read and prepare changes to one cross-context position, heading, and applicable movement-group truth. |
| `DungeonExchange` | Import/export UI | Gate content-bound import plans, commit validated mappings once, and publish privately staged package or document exports atomically. |
| `DungeonRecovery` | Recovery UI | Create and restore-test backups, invoke owner migrations, retry or restore a backup, and keep failed state read-only. |
| `Travel` | Dungeon/Hex workspaces and global compact context | Configure the Travel session; plan and commit journeys, segments, pursuit, overrides, interruption, and factual entries. |
| `TravelActiveContext` | `DungeonAudienceQuery`, player presentation, Travel controls | Publish one revisioned active exploration actor/group identity validated against Party membership and Placement. |
| `TravelCompactContextQuery` | Global compact `Reise` contribution | Resolve active Party placement to `NoContext` or one approved-provider summary keyed by Party, placement, provider, and source revisions without exposing commands. |
| `Perception` | Travel, autonomy, `DungeonAudienceQuery`, and GM views | Evaluate directional knowledge; prepare active-check, discovery, reevaluation, forced-knowledge, and track-knowledge changes. |
| `CampaignDecisions` | Travel, autonomy, event sources, GM controls | Prepare, request delivery, record idempotent presentation, and consume current explicit GM resolution for exactly one continue or abort transition without owning the fictional outcome. |
| `ActorAutonomy` | GM controls and initiating coordinator | Control enabled state and jobs; prepare bounded active or catch-up steps; expose cursors, explanations, Decision Inbox references, and committed outcomes. |
| `EncounterRuntime` | Encounter UI and Scene reconciliation | Own materialized per-Scene Encounter runtime, applied Scene stamps, and the atomic complete-outcome phase program. |
| `WorldRuntime` | Encounter, Autonomy, World Planner views | Own NPC lifecycle, consumed finite stock, and other confirmed live quantities while referencing external authored definitions. |
| `SceneReconciliation` | Scene and Encounter Runtime | Correlate desired and applied context stamps, visible pending status, supersession, and retry without treating Scene as a root partition. |
| `CampaignHistoryQuery` | GM campaign-history view | Merge immutable owner-typed factual entries and linked corrections without becoming a write owner or replay source. |
| `DungeonFamilyBundle` and narrow family facets | Application composition only | Bind separately owned authored, workspace-tool, projection, durable-mapping, package-codec, and optional spatial contributions without becoming a business capability. |
| `SpatialProviderBundle` and narrow provider facets | Application composition only | Bind separately owned Travel routing, Placement anchor, position-codec, and bounded-summary facets without exposing one cross-owner provider interface. |
| `CampaignClock` | Travel, Autonomy, event and other time initiators | Publish an interval proposal and prepare the sole time advance only with complete Autonomy coverage evidence. |
| `TravelEventSource` | Travel composition | Produce a bounded, versioned event plan declaring decision boundary, snapshot/phase dependencies, and typed owner-phase requests without deciding fictional outcomes. |
| `AutonomyNeedFamily` | Actor Autonomy composition | Contribute typed need state transition, priority, explanation, and configuration without becoming a job family. |
| `AutonomyJobFamily` and `AutonomyOfferSource` | Actor Autonomy composition | Contribute job evaluation or local offers and owner-operation requests without bypassing target or effect owners. |
| `AutonomyQualificationEnvelope` | Autonomy preparation, admission, and conformance proof | Bound candidate, route, touched-partition, phase, evidence, encoded-write, and interval-evidence work for the 200-actor latency class. |
| `HeavyOperationToken` and `SnapshotLease` | Progressive spatial/query operations | Resume from a bounded traversal frontier while retaining source revisions only within explicit byte/time limits and typed expiry. |
| `ProspectiveFacts` | Earlier and later phases of one typed program | Publish owner-typed proposed results bound to partition generations and read evidence for dependent pure validation. |
| `CalendarIntervalProposal` and `AutonomyCoverageEvidence` | Campaign Clock, Autonomy, and time initiators | Bind one interval to active work, enabled-context-set generation, and shared catch-up evidence before the sole time write. |
| `CatchUpEvidenceSegment` and `CatchUpCheckpoint` | Actor Autonomy | Preserve deduplicated interval evidence and bounded per-context progress without reconstructing historical work from current truth. |
| `ConflictResolutionFacts` | Autonomy and affected owners | Seal non-presented operation-scoped random inputs and resolved bounded-conflict facts during cancellable preparation for owner certification. |
| `CampaignPartitionDefinition<S>` | Live Campaign Root composition | Bind one concrete owner's typed state, reducer, codec, migration, query facet, and stable partition key without a generic business payload or dispatch switch. |
| `CampaignPhaseProgram<R>` | Initiating capability | Declare read/write/invariant/declassification sets and fold typed owner reducers over one candidate root outside the writer frontier. |
| `CampaignCommitReceipt` | Initiator, operation-status query, workspace journal | Report one terminal operation, touched partitions, revisions, and owner-opaque inverse tokens independently of delivery. |
| `CampaignOperationStatus` | Initiating adapters, workspace, retry flows | Resolve pending or terminal outcome by operation identity and fingerprint before any retry or repair. |
| `OutboxBatch` | Durable delivery adapters | Carry atomically enqueued owner facts and non-mutating notifications/publications with idempotent delivery state, never undo intent or owner commands. |
| `CampaignRootCommit` | Initiating phase programs | Revalidate operation and read evidence; atomically publish touched partition generations, manifest, history, outcome, receipt, and outbox. |

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
5. Commit assigns an operation identity and sends the command and expected
   revision `R`. The Authoring phase program derives proposed geometry and
   identity before folding dependent relocation, environment, and route changes
   through Campaign Placement, Dungeon Runtime, and Travel reducers.
6. The operation enters the non-cancellable commit section only after the
   declared dependency closure and candidate root validate. `CampaignRootCommit`
   revalidates and publishes all touched partitions, the terminal outcome, one
   receipt, edit-history entries, and any outbox batch atomically.
7. Accepted work records the receipt for undo. Touched facts invalidate derived
   generations. In-flight queries complete against their named revision; new
   owner queries can address the committed revision immediately, while derived
   views expose loading until their replacement projection is usable.
8. Undo or redo submits the receipt's owner-opaque inverse tokens through the
   same steps; stale inverse work is rejected without changing any owner. A new
   accepted edit after undo truncates redo. If the result of any submission is
   unknown, the workspace queries the operation outcome before allowing retry.

### Travel Segment

1. Travel moves from `planning` to cancellable `preparing-segment` and asks the
   current `TravelSpatialFacet` for route and cost facts from an explicit
   authored, runtime, and placement revision tuple.
2. Perception and source-owned event plans are evaluated from the same tuple.
   Every event plan classifies a required decision as `PreIntervalDecision` or
   `PostSegmentDecision` and declares its snapshot dependencies and typed phase
   requests. A decision is reduced into the Decision Inbox rather than
   represented only as a UI action.
3. Travel runs an acyclic typed phase sequence. Campaign Placement and Dungeon
   Runtime derive prospective movement and track facts; Perception and concrete
   effect-owner reducers consume those facts. Campaign Clock advances only after
   Autonomy produces complete coverage evidence. Decision Inbox is touched only
   when a prompt or Party-danger boundary is reached.
4. The operation crosses the commit frontier only after preparation.
   `CampaignRootCommit` commits position, heading, elapsed time, tracks,
   knowledge, active Autonomy results, catch-up evidence and coverage,
   interruption, a post-segment pending decision, environment state, and owner
   factual entries atomically. A pre-interval decision instead commits only the
   pause/cursor and Inbox entry and leaves position, time, and interval effects
   unchanged.
5. The resulting durable journey state is `ready-to-continue`,
   `prompt-pending`, `paused`, `blocked`, `failed`, `completed`, or `aborted`,
   with its specific reason and permitted next actions.
6. Prompt delivery retries idempotently from the outbox. A delivery failure does
   not roll back the segment or lose the pending decision. Presentation records
   `presented` only after the prompt is usable. Continue and decision-bound abort
   each consume the current presented revision plus their explicit GM choice and
   may transition the decision only once. Ordinary pre-decision journey
   cancellation remains a separate Travel command.
7. Autoroute continuation always starts from the newly committed revisions.

### Actor Autonomy Step

1. The GM confirms a campaign-time boundary through an initiating time command.
   If Travel initiated that interval, this runtime view is one phase of the
   Travel program rather than a second time-advancing operation.
2. Autonomy enters cancellable `evaluating`. Active-context work reads one
   shared current revision tuple; inactive catch-up reads the immutable input
   facts referenced by its checkpoint. It obtains local offers and
   spatial facts in bulk, bounds candidate and route work, and resolves
   reservations in a deterministic planning phase.
3. Candidate choice remains deterministic. Party danger or another GM-owned
   decision takes a separate pause branch: Autonomy prepares only its pause or
   catch-up boundary and exact continuation cursor, and the Decision Inbox
   prepares its own entry. Their
   atomic commit leaves movement, campaign time, needs, jobs, effects, and
   random results unchanged, then ends as `paused-for-decision`.
4. When no decision blocks the action, work that cannot stay inside the
   qualified bound returns a typed
   progress-capable result rather than starting unbounded hidden work.
5. For bounded non-party conflict, Autonomy creates a sealed operation-scoped
   roll package during cancellable preparation and does not present it. It
   publishes certified `ConflictResolutionFacts`, including the resolved
   protection-bounded outcome, before movement, resource, possession, actor, or
   other effect owners prepare their exact write sets. Rejection or cancellation
   persists neither roll nor effect.
6. `CampaignRootCommit` commits all need, job, group, reservation, movement,
   time, concrete owner-effect, random-result, event, applicable decision, and
   history facts atomically.
7. The final state is `committed`, `paused-for-decision`, `rejected`, or
   `cancelled`. Owner rejection identifies the owner and repairable cause while
   preserving the previous confirmed campaign-time boundary. Continue resumes
   the referenced cursor; abort preserves it as a resumable paused boundary.

### Encounter Outcome Confirmation

1. Encounter keeps the current Resolution selection and assigns one stable
   operation identity plus a fingerprint covering result, eligible Party IDs,
   calculated XP, selected World consequences, and source stamps.
2. The Encounter-owned phase program reads the Encounter Runtime, PartyCampaign,
   and WorldRuntime partitions plus immutable stamped definitions. It validates
   the complete Party progression closure and every selected loss or stock fact.
3. Any stale input, missing definition, unavailable required partition, or owner
   rejection leaves all current state and the submitted selection unchanged.
4. `CampaignRootCommit` marks the Encounter completed, applies Party XP and
   WorldRuntime consequences, stores effect receipts, and appends one correlated
   history outcome atomically. It does not mutate or close Running Scene.
5. Commit-before-response retry resolves the stored outcome. The same intent can
   never award XP, consume stock, defeat an NPC, complete the Encounter, or append
   its history twice.

### Party Membership Reconciliation

1. Party validates and commits activation, deactivation, or deletion in its own
   root phase program. The commit advances audience authorization and appends the
   membership history fact immediately.
2. Activation leaves the character unassigned. Deactivation or deletion makes
   the character unavailable to all current-Party reads immediately.
3. A non-mutating membership-change publication carries the accepted Party
   revision without enumerating Scene. Scene compares that revision with its
   running references, persists desired membership and a pending Encounter stamp
   only when affected, and never repeats the Party command.
4. Encounter Runtime applies the newest desired stamp idempotently while
   preserving valid initiative, HP, round, and turn state where applicable.
   Scene records synchronization only for that exact applied stamp.
5. Failure at either dependent step leaves Party authoritative, keeps the Scene
   usable and visibly pending, never presents stale Encounter context as
   synchronized, and retries from initialization, refresh, or explicit retry.

### Perception And Track Control

1. A Runtime command adds, corrects, or suppresses a physical track against an
   explicit Runtime revision. Perception is not enlisted unless knowledge must
   change in the same initiating operation.
2. A search binds one physical-track identity and Runtime revision, then
   Perception evaluates or applies the GM-entered active result and prepares
   directional track knowledge. Stale track facts reject without changing the
   current input or selection.
3. Confirm discovery, force known or unknown, clear an active check, and request
   reevaluation are Perception commands. Their rejection or failure preserves
   previous committed knowledge and the submitted GM input for retry or edit.
4. When detection involves the Party, Perception runs one root phase program
   that pauses the active Travel route and affected Autonomy work while creating
   the pending Decision Inbox entry. No touched partition may publish or continue
   independently.

### Dungeon Runtime Operation

1. Dungeon Runtime initiates a manual environment correction, confirmed Trap
   charge/reset change, or named state action against explicit authored and
   runtime revisions while preserving the submitted GM input.
2. For a local correction it reduces its partition change and factual entry. A
   named action declares every affected environment or concrete effect-owner
   partition; triggers supply facts but do not decide a free GM outcome.
3. Work remains cancellable before the normal commit frontier. The root commit
   stores all touched changes, factual entries, terminal outcome, receipt, and
   any non-mutating notification atomically.
4. Stale input or owner rejection changes nothing and offers reload, edit, or
   retry with the GM input intact. An unknown result is resolved by operation
   identity before another command is prepared.

### Travel Session Control

1. `SetExplorationRoundDuration` validates a preset or custom duration against
   the current `TravelSessionConfiguration` revision. Acceptance atomically
   advances that revision. Validation, stale input, failure, or rejection keeps
   the prior committed duration and submitted value available for correction or
   retry; an unknown result is resolved by operation identity.
2. Travel owns speed/member overrides and coordinates split, form, or merge
   intents with Campaign Placement. Affected routes, pursuits, reservations, and
   group readbacks are invalidated or repaired in the same operation. A group
   change that would invalidate the active exploration focus includes an
   explicit replacement focus or is rejected.
3. `SetActiveExplorationFocus` validates the submitted actor/group against the
   current Party membership and Campaign Placement revisions and advances the
   Travel active-context revision atomically. Invalid or stale focus preserves
   the prior focus and submitted selection for correction.
4. `SetPosition` is a distinct Campaign Placement operation using the provider's
   `PlacementAnchorFacet`. It explicitly excludes Calendar advance, event
   activation, route validation, and automatic track generation while
   invalidating dependent projections and routes.
5. Rejection or stale input changes no group, route, override, or position and
   preserves selected actors, destination anchor, and entered overrides for
   edit or retry. Unknown outcomes use the common operation-status query.

### Catalog, Exchange, And Recovery Operations

- Catalog lifecycle commands expose the touched partitions, destructive
  boundary, progress, typed rejection, and final lifecycle state. Archive and
  Runtime pause are one transaction; cancellation before commit changes neither.
- Catalog create commits its identity and required roots together. Rename and
  lifecycle commands advance the Catalog revision; destruction is allowed only
  from the policy-derived eligible state or an explicit immediate-destruction
  command.
- Import proceeds through `staging`, `validating`, `mapping-required`,
  `ready-to-commit`, and a short atomic commit. Retryable failure preserves the
  content-bound validated plan and mappings. Explicit discard or safe
  cancellation removes it; unsafe or oversized input is terminated or
  quarantined. Destination revision drift offers rebase/remap or discard and
  leaves existing Dungeons unchanged.
- Export proceeds through `preparing`, `rendering-private`, and
  `ready-to-publish`, with progress and cancellation before one atomic
  publication. Failure removes private staging and neither exposes a partial
  artifact nor changes the previous destination.
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
Dungeon. An indexed conservative estimator must itself finish inside the
interactive admission budget and predict region, fact, byte, dependency fan-out,
and traversal bounds before expensive traversal. Its upper-bound summaries are
part of the region/dependency index and are maintained incrementally by the
commits that change those keys. Work already above the interactive quota returns
a resumable heavy-operation token immediately.

Admitted interactive work continuously enforces its deadline and region, fact,
byte, and traversal ceilings. Crossing any ceiling stops further interactive
expansion and returns a token that resumes the same revision-bound operation in
bounded background work units with progress and cancellation. Escalation never
publishes a partial result or weakens invariant validation. Contracts define
the qualification budgets, token, and typed escalation results without imposing
a fixed coordinate limit on valid authored Dungeons. Every token stores a
bounded traversal frontier and owns a byte- and time-bounded `SnapshotLease` for
its source revisions. Lease expiry returns typed `expired` or
`restart-required`; it never silently restarts while claiming to resume. Token
cancellation, completion, expiry, and owner-session closure release the lease.

## Extensibility Model

Extensibility is compile-time capability composition, not runtime plugins.

### New Authored Object Or Tool Family

A new family remains one vertical slice but does not expose one cross-owner
mega-interface. Its authored facts, invariants, and commands implement an
Authored-owned facet; its Workspace tools, projections, durable mappings,
package codecs, and optional spatial behavior implement separate narrow facets
owned by their consuming capability or adapter boundary. A composition-only
`DungeonFamilyBundle` binds those facets at the application composition root. It
owns no business truth and is not a public Authored World capability. A tool
produces typed authored commands but does not modify query, storage, exchange,
or render internals directly.

Every spatial family is purpose-specific. A generic Marker or Prop extension
cannot bypass ownership: authored furnishings and table-facing interactions are
Curiosities, while Encounter and Loot placements reference their external
owners.

Adding the family changes its own facets and one application composition entry.
Stable Workspace, Query, Exchange, and durable ports consume only their narrow
facet without family-specific switches. It must not require changes to Travel,
shell contracts, unrelated features, or generic persistence mechanisms unless
it deliberately publishes a new spatial capability.

### Travel, Time, Or Event Rule Change

Movement calculations use explicitly versioned rule profiles behind Travel
policies. A composition-only `SpatialProviderBundle` binds a
Travel-owned `TravelSpatialFacet`, a Campaign Placement-owned
`PlacementAnchorFacet`, an adapter-owned `PositionCodecFacet`, and a bounded
`SpatialSummaryFacet` for compact readback. Each consumer receives only its
facet; the bundle owns no cross-capability behavior or state.

`CampaignClock` is the preparation seam for the Calendar owner. Each
`TravelEventSource` owns its bounded candidate rule and returns an event plan
that classifies pre-interval versus post-segment decisions, declares input and
phase dependencies, and requests typed owner phases. A Travel event composer
resolves those requests
without source-specific branches. The Decision Inbox owns only a resulting
pending GM decision. A rule or provider change replaces or adds one narrow
contribution plus its application-composition binding and conformance proof.
Dungeon continues to publish neutral geometry, terrain, Passage, and event
facts. Presentation and persistence consume the same versioned result rather
than duplicating rules.

Actor Autonomy composes separate typed `AutonomyNeedFamily`,
`AutonomyJobFamily`, and `AutonomyOfferSource` contributions. Need families own
their state transition, priority contribution, explanation, and configuration;
job and offer facets may evaluate candidates and request operations. A target,
reservation, spatial move, or foreign effect is prepared only through its owning
typed root partition and reducer. Adding a need, job family, offer source,
provider facet, or effect owner changes its narrow contribution, the affected
phase programs, and its conformance proof rather than the root kernel or
unrelated capabilities. An effect without a confirmed atomic campaign operation
remains an external owner and has no root contribution.

### UI Or Persistence Adapter Replacement

UI adapters depend only on capability commands and projections. Persistence
adapters implement owner-defined durable ports and package codecs. Neither
adapter contains business validation, identity allocation policy, reassociation
rules, travel decisions, or projection ownership. Replacing an adapter therefore
does not change capability behavior or unrelated features.

Replacing a UI technology changes its adapter slice, shell/application
composition binding, adapter-local presentation-session binding, and focused
conformance proof. Business capabilities, durable truth, and unrelated features
remain unchanged.

Replacing one root-partition adapter on the same durable substrate changes that
owner's codec/migration slice, its application-composition binding, and focused
conformance proof. Replacing the root persistence technology necessarily changes
the manifest/commit adapter, all partition codecs, Recovery integration,
composition, and their conformance proofs. It does not change owner reducers,
business interfaces, UI contracts, or portable package formats.

## Quality Architecture

| Scenario | Architectural response | Measure from requirements |
| --- | --- | --- |
| Open a 100,000-cell sparse Dungeon | Indexed bounded viewport, progressive projection, no whole-Dungeon hydration | First usable viewport and context under 2 seconds p95 |
| Pan or hover | Adapter-local input, bounded visible projection, replaceable work | 16 ms p95 |
| Preview local edit | Bounded conservative admission estimate, continuous work ceilings, resumable heavy escalation, no persistence round trip after closure load | 50 ms p95 |
| Commit ordinary edit | Exact touched closure, immutable root snapshot, pure phase program and short touched-partition publish | 500 ms p95 |
| Confirm Encounter outcome | One root commit across Encounter Runtime, PartyCampaign, WorldRuntime, receipt, and history | Wholly old or wholly new; retry produces no duplicate effect |
| Reconcile Party membership | Party-authoritative commit plus affected-only Scene/Encounter desired/applied saga | Party available immediately; stale context never shown synchronized |
| Run heavy route, graph, or batch preview | Background work with progress, cancellation, and independent query lanes | Progress within 100 ms; cancellable above 2 seconds |
| Update passive player view | Deny-by-default authored/runtime/placement/perception/Party/Travel-focus join, one authorization generation, fail-closed invalidation | 100 ms p95 |
| Advance 200 autonomous actors | Shared active snapshot, deduplicated inactive evidence, bulk local candidates, bounded routes, deterministic reservations, certified Calendar coverage | 2 seconds p95; progress within 100 ms |
| Crash or failed migration | Atomic durable transaction, pre-mutation restore-tested backup, read-only failure mode | Wholly old or wholly new state; original and backup preserved |
| Import malformed or oversized package | Untrusted staging, structural and resource gate, cancellable validation before domain materialization | Typed rejection; no Catalog, authored, runtime, or recovery mutation |
| Export package or audience document | Authorized destination, quota-bounded private staging, input revalidation, atomic publication | Cancellation or failure exposes no partial artifact and preserves the prior destination |

The 200-actor latency class is qualified only inside an owner-approved
`AutonomyQualificationEnvelope`. It places contract-defined maxima on locally
reachable candidates per actor, route work, affected partition count, phase
nodes and edges, evidence bytes, encoded writes, and shared
interval-evidence scope plus enabled-context-set size. Admission estimates those
dimensions before expensive work. Crossing a preparation limit escalates to cancellable progress-capable
work; crossing a touched-partition, evidence, or encoded-write ceiling rejects
before the commit frontier. Exact numeric maxima belong to the Autonomy
conformance contract, but no qualification may omit a dimension. Proof uses 200
actors plus concurrent viewport/player reads and records preparation bytes, phase
size, evidence checks, write duration, total p95, and read latency.

Catch-up qualification also uses many enabled inactive contexts and a long
interval history. It records per-advance work, deduplicated retained bytes,
compaction cost, catch-up progress/cancellation, and restart at a pinned pending
decision. Evidence retention must stay inside its contract envelope without
touching every inactive context on an ordinary active-context advance.

Long-running work never owns the UI thread. Commands and query results expose
loading, success, typed rejection, cancellation, and failure distinctly.
Diagnostics record operation identity, duration, revision, affected counts, and
failure category without copying authored content or secrets.

Projection qualification captures one campaign read snapshot, bulk-loads each
bounded owner slice, reuses revision-keyed subprojections, and coalesces
superseded invalidations to the newest publishable vector. A continuous commit
stream cannot postpone a usable current player projection beyond its existing
post-change budget. Proof records discarded work, queue depth, reused slices,
time since the newest publishable vector, and player-view p95 under sustained
movement, visibility, Party, and authoring commits.

Preparation and projection run against immutable committed snapshots outside the
write transaction. Reads remain available on the previous committed revisions
while a prepared change is applied. Qualification records total duration,
duplicate preparation work, write-transaction duration, stale retry rate,
certificate/read-set failure rate, closure and invalidation counts, queue depth,
and concurrent read latency; the transaction design is acceptable only while
the existing viewport, player-output, and 200-actor budgets remain green under
concurrent commits.

Workspace snapshots, protected graph drafts, and at least 200 ordinary undo
receipts use encoded patches or copy-on-write state rather than full-Dungeon
copies. One Workspace-owned hard resource envelope covers their combined memory
and session-local spill storage while reserving guaranteed minima for the
protected draft/checkpoint and ordinary undo capacity. Shared physical pages are
charged once; allocation, copy-on-write retention, and spill are continuously
accounted against the aggregate ceiling. Ordinary journal eviction cannot
destroy the protected base or intent journal. Oversized work is classified
before large allocation, and accept, discard, and session close perform bounded
cleanup. Exact aggregate/minimum budgets and spill policy belong to the editor
contract and are verified with a 100,000-cell protected draft, raster repair,
200 receipts, peak retained bytes, spill latency, and the interaction budgets.

## Persistence, Versioning, And Recovery

Each root member owns its logical partition schema, reducer, codec, query API,
and migrations. One physical Campaign store holds a two-level immutable
manifest: a small root directory points to owner directories, which point to
chunked or aggregate generations. A commit copies and writes only touched
directories and nodes; work at constant touched scope cannot scale with all
Dungeon cells, Encounters, actors, or installed partitions.

`CampaignRootCommit` revalidates operation fingerprint, root and read
generations, range/negative-read evidence, declared write set, and candidate
invariants inside one short writer transaction. It publishes touched partition
generations, new manifest and campaign revision, terminal outcome,
`CampaignCommitReceipt`, factual history, and `OutboxBatch` together. Query
projection captures the revision and exact partition generations as
`CampaignRootSnapshot`. No full root object graph exists.

Each command and query has a statically reviewable dependency closure. An
unreadable unrelated partition is carried forward by identical opaque reference
and its codec or migrator is never called. Owner code cannot receive another
partition's bytes, a store handle, or a commit callback. Long work, backup,
migration copy, GC, and projection stay outside the bounded writer frontier.

The initiating capability owns operation identity, intent semantics, and
terminal result meaning. The root mechanism owns publication but no semantic
partition. Owner-defined outbox facts retain their source owner; the outbox owns
only delivery state.

Owner partitions have independent schema generations. Authored portable package
versions remain independent of root storage versions. External rule profiles,
definition snapshots, generated projections, and history retain the version or
stamp needed to explain their result.

Before migration, the recovery capability creates and restore-tests a backup.
Migration builds and validates the new state before making it writable. Failure
keeps the old state and backup intact and exposes diagnostics, retry, and
restore from backup. Rolling and manual backup retention is policy-driven rather
than embedded in feature adapters.

Each capability appends only its own factual entries: Authored World records
authored edits, Campaign Placement records administrative relocation, Travel
records travel, Autonomy records autonomy, Perception records knowledge
override/correction, Dungeon Runtime records environment/runtime events, Party
records membership and XP, Encounter records completion, and World Runtime
records lifecycle or consumed-stock consequences.
Entries share the initiating operation identity and applicable campaign-time
boundary. A derived campaign timeline merges them and may join a Decision
Inbox's semantic `presented` acknowledgement to report an opened prompt without
becoming another log owner. Corrections append explicit overrides or correction
facts; they do not rewrite historical results. Entries preserve stable identity
and historical display facts needed after rename or deletion. The merged history
is explanatory, not replay or restore input. Editor undo is a separate session
facility and is not part of those logs or portable packages.

## Dependency Rules

- business capabilities may depend only on other capabilities' published
  contracts, never their domain objects, adapters, or storage
- presentation and storage depend inward on capability ports
- Dungeon Spatial Context may read Dungeon owners but never Travel, Campaign
  Placement, Perception, or Autonomy internals
- Travel, Perception, and Autonomy may consume Dungeon Spatial Context without
  taking ownership of Dungeon facts
- projections that display movable objects read Campaign Placement only through
  its bounded revisioned projection; audience queries additionally accept the
  Party-owned root audience context, Travel-owned active focus, and adapter-owned
  presentation revision as inputs without taking ownership of them
- an initiating capability's phase program may import only the concrete owner
  reducers and published query contracts required by its declared closure
- the root kernel depends only on manifest, generation, operation, receipt,
  lease, and commit primitives; it contains no feature business type, owner
  switch, generic effect payload, store callback, or workflow registry
- dependent phases consume only typed prospective facts from earlier pure
  phases; they never read another partition's encoded bytes or mutable state
- Campaign Clock is the only time writer and requires Autonomy coverage evidence
  bound to the active context, enabled-context-set generation, and shared
  interval evidence
- Scene remains external; only `SceneReconciliation` may join Scene desired
  stamps with Encounter Runtime applied stamps, and pending is never represented
  as a root-atomic Scene mutation
- saved Encounter plans, World definitions, Creatures, Items, Encounter Tables,
  Session Planning, generated artifacts, and rule archives enter root programs
  only as immutable stamped inputs
- player display and visibility-filtered export depend on
  `DungeonAudienceQuery`, never unrestricted `DungeonQuery`
- compact `Reise` publication is keyed by active Party, selected Placement, and
  provider-source revisions; an older provider result cannot replace a newer
  Party-placement generation
- Exchange may produce owner-prepared import changes only after its untrusted
  package gate succeeds; package data never selects Recovery artifacts
- outbox delivery is non-mutating; an admitted business effect is part of the
  originating root phase program, while an external effect uses an explicit
  idempotent destination command and visible saga semantics
- derived projections depend on committed owner facts; owners never depend on
  projections
- family, spatial-provider, event, and autonomy extension bundles exist only at
  application composition; each capability sees only its narrow owned facet
- adapters may share feature-neutral execution, transaction, rendering,
  diagnostics, and backup mechanisms, but those mechanisms own no Dungeon
  meaning

## Decisions And Alternatives

### One local capability-modular application

Chosen to support one operator, local data, low latency, and atomic multi-owner
steps. Distributed services were rejected because no confirmed need offsets
their partial-failure and synchronization cost.

### Cohesive Live Campaign Root rather than external participants or Full Live

Chosen because confirmed Dungeon edit/travel/autonomy operations already cross
spatial owners, and every completed Encounter normally crosses Encounter
Runtime, Party progression, World Runtime, and campaign history. Separate
durable roots or a generic participant protocol would make cross-owner commit the
normal path while hiding one physical authority behind callbacks and encoded
write sets.

PartyCampaign and Encounter Runtime therefore join the complete already-atomic
campaign invariant closure. Running Scene does not: accepted behavior requires a
valid Scene or Party change to survive an unavailable Encounter as visible
`pending`. Planning, templates, reference corpora, authored World definitions,
and independent live tools likewise remain external because immutable stamps or
explicit sagas satisfy their confirmed flows.

A Full Live Root was rejected as an admission rule. Restart relevance, a useful
current read, or a possible future relationship does not justify common writer,
migration, retention, restore, and removal governance. A new owner joins only
for a confirmed old-or-new operation and only with its complete invariant
closure and removal of the former write path. A Whole Application Root was
rejected because Planning, artifacts, and references have different
prepare/cancel/retention lifecycles.

### Partitioned authored world rather than one hydrated aggregate

Chosen because correctness needs one logical Dungeon while performance requires
bounded work. A mandatory whole-Dungeon aggregate was rejected because local
work would scale with all 100,000 cells. Independent region owners were rejected
because cross-region identity and geometry would lose one consistency owner.

### Pure phase programs and one root commit rather than sagas

Chosen for travel, live editing, links, and autonomy because their requirements
forbid partially committed owner state. Eventual compensation was rejected as
observable corruption for position/time, geometry/relocation, or conflict
effects.

Preparation is side-effect-free and may be long-running. An initiator-owned
typed phase sequence and prospective facts were chosen because dependent owners must validate
geometry, placement, perception, time, and effect results before any one of them
exists as committed state. Independent preparation without those facts was
rejected because it cannot prove the final combined invariant. Random conflict
input is sealed during preparation as prospective facts; creating it at the
commit frontier or making the root kernel choose an outcome branch
was rejected because affected owners could not validate their exact writes.
Read-evidence revalidation, touched-partition publication, terminal outcome,
history, receipt, and outbox insertion share one short durable transaction. A
single central business coordinator was rejected because each new operation
family would otherwise change it; the initiating capability owns orchestration.

### Authoritative state plus audit journal rather than full event sourcing

Chosen because the product needs current durable truth, explicit logs, editor
undo, and recovery but does not require replaying every historical command to
construct normal reads. Full event sourcing remains possible later but is not
required and would increase migration and projection complexity.

Factual history remains partitioned by its business owner and is correlated by
operation and time-boundary identities. One shared writable factual log was
rejected because it would either duplicate ownership or require a central owner
for Travel, Autonomy, and Runtime meaning.

### Shared project capabilities for Travel and Perception

Chosen because Dungeon, Hex, actor autonomy, and player output need one travel
context and one perception truth. Duplicating those decisions inside every
spatial feature was rejected. Dungeon retains its geometry and environment
semantics through the Spatial Context interface.

### One campaign-time frontier per confirmed interval

Calendar commits one boundary for each GM-confirmed interval only after Autonomy
certifies detailed active-context work, the enabled-context-set revision, and
shared immutable catch-up evidence. Independent Travel and Autonomy time commits
or coordinator-only completeness conventions were rejected because they can
double-advance time, omit a context, or leave enabled actors behind the
committed campaign boundary.

### Typed compile-time extensions rather than generic plugins

Chosen because local source change is the stated extensibility need. Narrow
owner facets joined only by application composition preserve local additions
without creating a public family registry that owns commands, projections,
storage, and exchange at once. A cross-owner family mega-interface and a generic
runtime plugin platform were rejected as weaker ownership, type, migration, and
recovery boundaries.

### Derived multi-view projections rather than view-owned models

Chosen so raster, graph, key, travel, export, and player output remain coherent.
Allowing each view to persist its own Room, connection, or passability model was
rejected because synchronization would become a business workflow and produce
multiple truths.

### Explicit audience declassification rather than adapter filtering

Chosen because the player display and visibility-filtered exports must be
incapable of receiving GM-only truth. Filtering inside a renderer or generic
query consumer was rejected because omission would remain optional and one
adapter mistake could reveal authored secrets. Temporary presentation override
remains adapter-local, but its revision is a mandatory audience-query input. One
authorization generation covers every authored, runtime, placement, Perception,
Party, audience-profile, and presentation revision; any source change
synchronously invalidates the previous sink DTO. Keeping a stale revealed or
formerly known frame during loading was rejected as a disclosure path. Party
identity and membership remain a separate Party-owned input, while Travel owns
the active exploration actor/group focus. Presentation cannot define either
whose knowledge is authorized or which split group drives camera follow.

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
- authoring, Travel segment/session control, Dungeon Runtime operation,
  perception/track control, autonomy, Encounter outcome, Party reconciliation,
  Catalog, import, export, and recovery runtime views cover loading, progress,
  cancellation, commit frontier, rejection, failure, repair, and preserved-state
  boundaries relevant to that operation
- every root operation names its initiating phase program, static read/write/
  invariant/declassification sets, typed prospective facts, read-evidence
  revalidation, terminal result, receipt, history, and outbox behavior
- every time-advancing operation has one Calendar change that depends on an
  Autonomy coverage evidence for active work, the enabled-context-set
  generation, and bounded shared evidence for the same interval
- every roll-dependent owner change prepares against sealed certified conflict
  facts created before the commit frontier
- live authoring and undo use the same atomic owner set, and one resolved spatial
  binding can never expose both authored and runtime current positions
- import retry preserves only safe validated plans, export publishes atomically,
  and unknown command outcomes are resolved by operation identity before retry
- Decision continuation or abort consumes one current presented decision
  revision plus explicit GM authority and cannot be triggered by delivery state
- Encounter outcome confirmation commits Encounter completion, Party XP,
  selected World Runtime consequences, receipts, and history wholly old or new;
  identical retry cannot duplicate any consequence
- Party membership commits independently of Scene, and only affected Scenes and
  Encounters may remain visibly pending without stale membership being presented
  as synchronized
- player output captures one campaign root snapshot and joins Campaign
  Placement, Party-owned root audience context, Travel-owned active focus, and
  presentation input under one authorization generation; no source change can
  leave an older DTO visible
- each measurable quality need maps to an architectural response and a future
  production-route proof
- Autonomy qualification bounds every named work dimension, heavy-operation
  tokens own expiring snapshot leases, and the Workspace enforces one aggregate
  resource envelope with protected minima
- authored families, spatial-provider facets, event sources, autonomy need/job
  families and offer sources, effect owners, and adapter replacements remain
  local by the dependency rules above
- an unreadable unrelated partition is never decoded, migrated, or validated by
  a command outside its declared closure; a new CityMap, Sense, concrete effect
  owner, or independent Campaign Journal changes no root-kernel switch
- campaign history records meaningful confirmed facts and linked corrections
  but is neither replay nor whole-campaign restore authority
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
- [Live Campaign Runtime Requirements](../../project/requirements/requirements-campaign-runtime.md)
- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)
- [Runtime Scene Requirements](../../scene/requirements/requirements-scene.md)
- [Accepted Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
