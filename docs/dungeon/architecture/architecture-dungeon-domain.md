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

Arrows mean “uses the published capability of”. Boxes are business owners;
presentation and storage adapters are outside the ownership boxes.

```text
Raster / Graph / Key / Travel / Player Display adapters
                         |
                         v
            +---------------------------+
            | Dungeon Query & Authoring |
            +---------------------------+
               |         |          |
               v         v          v
        Authored World  Runtime   Exchange & Recovery
               |         |
               +----+----+
                    v
          Dungeon Spatial Context
           /      |       |         \
          v       v       v          v
       Travel  Placement  Perception  Actor Autonomy
          \       |       |          /
           +------+------+---------+
                     v
             Campaign Step Coordinator
                     |
        Actor / Calendar / Encounter / Loot owners
```

This diagram is logical. It does not prescribe source folders, processes, or
storage tables.

## Capability Ownership

### Dungeon Catalog

Owns Dungeon identity, name, archive/trash lifecycle, duplication request, and
the association between a catalog entry and its authored and runtime roots. It
does not own geometry, runtime positions, or external campaign objects.

### Dungeon Authored World

Owns the complete portable Dungeon definition:

- voxel geometry, Volumes, explicitly described surface regions, and stable
  authored spatial identities
- Rooms, Levels, room groups, attributes, descriptions, visibility defaults,
  templates, and assignments
- Areas, parametric Paths, Passages, links, Dungeon-owned Trap and Curiosity
  definitions, trigger fields, environmental source definitions, and initial
  mechanism state
- placements and stable references for externally owned Encounters, Loot,
  actors, places, and other campaign truth without copying that foreign truth
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

### Dungeon Runtime Context

Owns durable Dungeon-local exploration facts that must not enter a portable
authored package:

- current Passage, light, sound, mechanism, Trap charge, and reset state
- physical tracks and transient or persistent environmental events
- active exploration context, open Dungeon prompts, runtime logs, and runtime
  archive/pause state
- the authored revision against which current routes and visibility were
  validated

Authored configuration supplies defaults and legal operations. Runtime state
records the current campaign instance. Editing authored geometry during
exploration may propose runtime relocations or invalidations, but only an atomic
campaign commit may publish both results.

### Actor Placement

Actor Placement is a project capability. It owns each actor's current spatial
context, provider-specific position, heading, and committed movement-group
membership. Party, NPC, monster, and inventory capabilities retain their own
identity and mechanical truth.

Dungeon defines and validates Dungeon coordinates through Dungeon Spatial
Context; it does not own the foreign actor placed at those coordinates. Travel,
authoring relocation, and Actor Autonomy prepare placement changes through this
capability. Moving across a Dungeon, Hex, or external-place boundary therefore
changes one placement truth instead of synchronizing feature-specific copies.

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
carry the source revisions from which they were built. Late results cannot
replace projections from newer authored or runtime revisions.

A specialized view may aggregate or omit facts, but it cannot invent a second
Room, connection, passability, description, knowledge, or selection identity.
Every view addresses the same stable references.

### Dungeon Exchange And Recovery

Owns versioned authored-package import/export, human-readable document export,
backup orchestration, migration safety, restore, and duplication mapping.

- portable packages contain authored truth and external references only
- human-readable export consumes projections and a visibility profile
- import first creates a conflict-resolution plan, then commits all accepted
  identity and reference mappings atomically
- duplication allocates new authored identities, rewrites internal references,
  preserves external references, and omits runtime and history
- migrations operate on backups and never make a partially migrated Dungeon
  writable

Storage adapters implement this capability's durable ports; they do not decide
identity, conflict, compatibility, or recovery policy.

### Project Travel

Travel is a project capability because active movement may cross Dungeon, Hex,
and external place boundaries. It owns journeys, routes, pursuit, exploration
round configuration, movement overrides, interruption state, and the factual
travel log. A Dungeon provider supplies Dungeon-specific route and cost facts.

The full Dungeon travel-control workspace uses this capability. The global
compact `Reise` contribution may select and display a current provider context,
but it remains a separate readback and does not become another command owner.

### Perception And Knowledge

Perception is a project capability shared by travel, the passive player view,
and actor autonomy. It owns directional actor/group knowledge, active-check
overrides, discovery confirmation, and track-knowledge state. Dungeon supplies
3D geometry, light, cover, sound, senses-relevant environment, and physical
tracks; actor owners supply senses and actor facts.

The same committed perception result feeds GM notification, route interruption,
autonomy, Fog of War, and player output. No presentation adapter recomputes a
private visibility truth.

### Actor Autonomy

Actor Autonomy owns enabled state, needs, job evaluation, reservations, current
jobs, group autonomy decisions, catch-up boundaries, consequence protection,
explanations, and its factual log. Dungeon offers reachable local jobs and
spatial operations. Foreign effects remain commands prepared by their owning
capability.

### Campaign Step Coordinator

The coordinator owns no business state. It coordinates atomic changes whose
invariants span capability owners:

- live authoring plus required actor relocation and route invalidation
- one completed travel segment plus position and campaign time
- one autonomy time step plus needs, jobs, movement, reservations, effects,
  random conflict results, and events
- paired cross-Dungeon Passage links

Each owner validates an intent against its own revision and returns an opaque
prepared change. The coordinator commits all prepared changes in one local
durable transaction or commits none. Business owners then publish facts from
the committed result. Events are notifications after commit; they are not used
to repair partial business state.

## State Ownership And Consistency

| State | Owner | Mutation path | Consistency boundary | Derived consumers |
| --- | --- | --- | --- | --- |
| Dungeon geometry and semantic content | Dungeon Authored World | Validated authored command | One command may cover one or several linked Dungeons | Raster, graph, key, route, export |
| Authoring preview and graph draft | Dungeon Authoring Workspace | Tool or graph intent | One transient workspace at a base revision | Authoring adapters only |
| Editor undo/redo | Dungeon Authoring Workspace | Successful authored commits and inverse intent | Current editor session | Authoring controls |
| Environment and Dungeon-local exploration | Dungeon Runtime Context | Runtime command or prepared campaign change | One Dungeon runtime transaction or Campaign Step | Travel, perception, player output |
| Actor position, heading, and movement group | Actor Placement | Owner command or prepared campaign change | Campaign Step | Dungeon context, travel, perception, autonomy |
| Journey, route, pursuit, movement overrides | Project Travel | Travel intent | One completed route segment | Travel workspace and compact context |
| Campaign time | Calendar owner | Prepared time advance | Campaign Step | Travel, events, autonomy |
| Directional knowledge and discovery | Perception And Knowledge | Perception evaluation or GM override | One perception/campaign step | GM context, autonomy, Fog |
| Needs, jobs, reservations, catch-up | Actor Autonomy | Confirmed campaign-time step or GM command | Campaign Step | Autonomy controls and summaries |
| Encounter, Loot, actor, item, place truth | Owning external capability | Owner command only | Owner-defined or Campaign Step | Stable references from Dungeon |
| Viewports, graph, key, descriptions, diagnostics | Dungeon Query Projections | Rebuild from committed revisions | Immutable projection revision | UI and exports |

No API allows a consumer to update another capability's storage directly.
Cross-owner invariants use prepared changes and the Campaign Step Coordinator,
not compensating writes or shared mutable models.

## Public Capability Interfaces

The names below are semantic interface families, not required code type names.
Detailed payloads, validation, compatibility, and error shapes belong in
contract specifications after this target is accepted.

| Interface | Consumers | Required behavior |
| --- | --- | --- |
| `DungeonAuthoring` | Raster, graph, key, batch, import | Preview and commit typed intents against expected revisions; return accepted facts or typed rejection. |
| `DungeonWorkspace` | Authoring adapters | Maintain selection, drafts, protected graph work, undo, redo, and conflict repair without owning authored truth. |
| `DungeonQuery` | All Dungeon views, export | Serve bounded immutable projections with stable identities and source revisions. |
| `DungeonSpatialContext` | Travel, perception, autonomy | Provide route, cost, arrival, visibility, environment, track, and local job-offer facts without foreign business decisions. |
| `DungeonRuntime` | Travel, perception, GM controls, Campaign Step | Read runtime context and prepare explicit runtime mutations or overrides. |
| `ActorPlacement` | Travel, spatial providers, perception, autonomy | Read and prepare changes to one cross-context position, heading, and movement-group truth. |
| `DungeonExchange` | Catalog and import/export UI | Plan and commit import, export authored packages, render documents, duplicate, backup, migrate, restore, archive, and destroy. |
| `Travel` | Dungeon/Hex workspaces and global compact context | Plan and commit journeys, segments, pursuit, overrides, interruption, and factual log entries. |
| `Perception` | Travel, autonomy, GM and player views | Evaluate and publish one directional knowledge result with explicit GM override semantics. |
| `ActorAutonomy` | GM controls and Campaign Step | Evaluate deterministic jobs, prepare bounded actions, expose explanations, and persist committed outcomes. |
| `PreparedCampaignChange` | Campaign Step Coordinator | Carry owner, base revision, validation result, durable change, and published facts without exposing owner storage. |

Interfaces use stable typed identities, explicit absence, typed rejection
reasons, revisions, and cancellation tokens where work may be long. UI strings,
null sentinels, storage keys, render nodes, and mutable domain entities are not
boundary protocols.

## Runtime Views

### Authoring Commit

1. An adapter translates input into a tool or graph intent.
2. The Authoring Workspace requests the bounded spatial and semantic closure
   required for that intent at revision `R`.
3. Preview computes only on that immutable closure. Missing data is loaded
   explicitly; it is never guessed.
4. Commit sends the authored command and expected revision `R`.
5. The Authored World validates invariants, identity preservation,
   reassociation, and affected external references.
6. During active exploration, Actor Placement, Dungeon Runtime, and Travel
   prepare actor relocation and route invalidation changes.
7. One local transaction commits every required prepared change and advances
   each affected owner revision once.
8. Touched-region facts invalidate derived projections and caches. Independent
   queries remain available while new projections load.

### Travel Segment

1. Travel asks the current Dungeon Spatial Context for a route segment and
   versioned cost facts.
2. Perception and event candidates are evaluated from the same authored and
   runtime revisions.
3. Travel, Actor Placement, Dungeon Runtime, Calendar, and any effect owners
   prepare changes.
4. The Campaign Step Coordinator commits position, heading, elapsed time,
   tracks, applicable environment state, and factual log atomically.
5. A prompt that requires GM resolution opens after commit. Failure to present
   it is retryable and cannot roll back the completed segment.
6. Autoroute continuation always starts from the newly committed revisions.

### Actor Autonomy Step

1. The GM confirms a campaign-time boundary.
2. Autonomy queries needs, local job offers, reachability, danger, and
   reservations from revisioned owner snapshots.
3. Candidate choice is deterministic; random input is created only for bounded
   non-party conflict after cancellation is no longer possible.
4. Every affected owner prepares its state change.
5. Party danger or another GM-owned decision rejects preparation and leaves the
   step paused before mutation.
6. The coordinator commits all actor, movement, time, reservation, effect,
   random-result, and log facts atomically.

## Sparse Spatial And Projection Architecture

The complete Dungeon is one logical whole, but it is never a mandatory in-memory
or query workset.

- spatial truth is partitioned by stable coordinate regions and indexed by
  identity, bounds, relationship, and revision
- a viewport loads the visible region plus bounded prefetch; a command loads
  the touched region plus the exact identity closure required by its invariant
- an identity appears once in a result even when it crosses several spatial
  partitions
- authored bounds are indexed metadata, not fixed map dimensions
- graph, key, routing, description, heatmap, and visibility indexes are derived
  and independently rebuildable from authoritative facts
- caches are bounded, revision-keyed, and invalidated by committed touched-fact
  sets; cache presence never changes correctness
- progressive loading distinguishes loading, usable partial projection, and
  complete requested projection
- replacement work such as hover, pointer preview, graph analysis, visibility,
  and route search is cancellable and may be superseded by a newer request

This keeps ordinary work proportional to visible or touched facts rather than
all off-screen Dungeon content.

## Extensibility Model

Extensibility is compile-time capability composition, not runtime plugins.

### New Authored Object Or Tool Family

A new family owns its authored facts, invariants, commands, projection
contributions, storage mapping, package mapping, and optional spatial behavior
as one vertical slice. It registers those contributions through typed extension
interfaces. A tool produces commands for one or more authored families but does
not modify query, storage, or render internals directly.

Every spatial family is purpose-specific. A generic Marker or Prop extension
cannot bypass ownership: authored furnishings and table-facing interactions are
Curiosities, while Encounter and Loot placements reference their external
owners.

Adding the family may change the Dungeon Authored World and its own adapters. It
must not require changes to Travel, shell composition, unrelated features, or
generic persistence mechanisms unless it deliberately publishes a new spatial
capability.

### Travel, Time, Or Event Rule Change

Movement and event calculations use explicitly versioned rule profiles behind
Travel policies. A rule change replaces or adds one profile and its proof data.
Dungeon continues to publish neutral geometry, terrain, Passage, and event
facts. Presentation and persistence consume the same versioned result rather
than duplicating rules.

### UI Or Persistence Adapter Replacement

UI adapters depend only on capability commands and projections. Persistence
adapters implement owner-defined durable ports and package codecs. Neither
adapter contains business validation, identity allocation policy, reassociation
rules, travel decisions, or projection ownership. Replacing an adapter therefore
does not change capability behavior or unrelated features.

## Quality Architecture

| Scenario | Architectural response | Measure from requirements |
| --- | --- | --- |
| Open a 100,000-cell sparse Dungeon | Indexed bounded viewport, progressive projection, no whole-Dungeon hydration | First usable viewport and context under 2 seconds p95 |
| Pan or hover | Adapter-local input, bounded visible projection, replaceable work | 16 ms p95 |
| Preview local edit | Immutable local closure, no persistence round trip after closure load | 50 ms p95 |
| Commit ordinary edit | Exact touched closure, optimistic revision, one atomic owner transaction | 500 ms p95 |
| Run heavy route, graph, or batch preview | Background work with progress, cancellation, and independent query lanes | Progress within 100 ms; cancellable above 2 seconds |
| Update passive player view | Shared revisioned perception projection and touched-region invalidation | 100 ms p95 |
| Advance 200 autonomous actors | Local candidate indexes, bounded routes, prepared atomic step | 2 seconds p95; progress within 100 ms |
| Crash or failed migration | Atomic durable transaction, pre-mutation restore-tested backup, read-only failure mode | Wholly old or wholly new state; original and backup preserved |

Long-running work never owns the UI thread. Commands and query results expose
loading, success, typed rejection, cancellation, and failure distinctly.
Diagnostics record operation identity, duration, revision, affected counts, and
failure category without copying authored content or secrets.

## Persistence, Versioning, And Recovery

Each capability owns its durable logical schema and migrations. One local
transaction mechanism supports atomic prepared changes across owners without
letting one owner read or write another owner's records directly.

Authored and runtime roots have independent versions. An authored package has a
portable format version independent of internal storage version. Rule profiles,
generated projections, and logs record the version needed to explain their
result.

Before migration, the recovery capability creates and restore-tests a backup.
Migration builds and validates the new state before making it writable. Failure
keeps the old state and backup intact and exposes diagnostics, retry, and
restore. Rolling and manual backup retention is policy-driven rather than
embedded in feature adapters.

The durable factual log is append-only from the user's perspective. Corrections
append explicit overrides or correction facts; they do not rewrite historical
travel or autonomy results. Editor undo is a separate session facility and is
not part of that log or portable packages.

## Dependency Rules

- business capabilities may depend only on other capabilities' published
  contracts, never their domain objects, adapters, or storage
- presentation and storage depend inward on capability ports
- Dungeon Spatial Context may read Dungeon owners but never Travel, Actor
  Placement, Perception, or Autonomy internals
- Travel, Perception, and Autonomy may consume Dungeon Spatial Context without
  taking ownership of Dungeon facts
- the Campaign Step Coordinator depends on prepared-change contracts, not
  feature-specific storage or business types
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

## Verification And Acceptance

While this document is `Draft`, its rules are review-owned and must not be
described as mechanically enforced by the current implementation. Acceptance of
this target requires:

- every active requirement capability is assigned to an owner or explicitly
  identified as presentation-only
- every stateful area has one owner, explicit mutation path, consistency
  boundary, and derived consumers
- the authoring, travel-segment, and autonomy-step runtime views cover their
  required failure and cancellation boundaries
- each measurable quality need maps to an architectural response and a future
  production-route proof
- the three extensibility scenarios remain local by the dependency rules above
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
