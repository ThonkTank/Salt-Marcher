Status: Draft
Owner: Aaron (Product Owner)
Last Reviewed: 2026-07-22
Source of Truth: Owner-confirmed observable cross-workflow needs for the
complete local SaltMarcher GM core. This draft is incomplete and is not yet an
architecture input.

# SaltMarcher Program Capability Requirements

## Goal

Define one coherent needs baseline for preparing, running, and following up on a
local tabletop Campaign before deriving technical needs or deciding feature,
module, persistence, integration, or technology boundaries.

The [Project Vision](../vision.md) remains the owner of users, top-level jobs,
and product non-goals. This document owns confirmed observable behavior that
spans or precedes individual feature requirements.

## Scope Boundary

- The binding horizon is the complete local GM-operated core product.
- Player-operated applications, remote play, and unspecified distant
  extensions are parked and cannot constrain the core architecture.
- A passive GM-controlled second-monitor output remains eligible for the core
  because it accepts no player input.
- Current code, feature names, feature requirements, architecture, and storage
  are not target constraints.

## Non-Goals

- choosing source modules, feature boundaries, APIs, schemas, databases,
  transaction mechanisms, frameworks, or other technologies
- scheduling implementation or preserving current implementation behavior that
  the owner has not confirmed as need
- treating this incomplete draft as the baseline for architecture review

## Confirmed Workflow: Campaign Foundation And Knowledge

### Campaign Lifecycle

The GM can create a Campaign with only a name and keep several Campaigns in
SaltMarcher. Switching happens immediately through options or settings. Running
Scene, Encounter, and travel state in the Campaign being left remains preserved
and resumes when the GM returns; switching requires no warning, confirmation,
or prior closure.

### Reusable And Campaign-Specific Knowledge

Rules, general Creature data, and Item definitions are reusable references
across Campaigns. PCs, NPCs, places, factions, quests, rumours, possessions, and
concrete Item instances belong to one Campaign. A Campaign-specific object may
be copied into another Campaign, where it becomes fully independent. Objects of
the same kind may share a name.

Campaign content references reusable definitions rather than owning copies.
Current and future play reads the current definition. Updating a definition does
not retroactively recalculate completed Scenes or their historical facts.

### Roster, Current Party, And Planning Party

Each Campaign has one `Roster` containing every Campaign PC, whether currently
participating or not. At most one current `Party` contains those Roster
characters whose players currently participate at the table. Groups assigned
to different Running Scenes are subdivisions of that Party, not separate
Parties.

A Session may be authored without a Party. Before generation, the GM selects a
planning-only expected Party from the Roster. This selection enables planning
calculations but neither is nor changes the current table Party.

### Minimal Creation And Explicit Deletion

A Campaign object requires only a name; every other property is optional and may
be completed later. When the GM creates an object from a Running Scene, the
creation dialog attaches it to that Scene by default and lets the GM opt out.

Explicit deletion removes an object from preparation, Running Scenes, and
Running Encounters, including runtime state that depends on it. Completed
history retains the historical fact but displays the missing identity as
`[UNKNOWN]`. If the object remains recoverable in trash, the history may link to
that recoverable object.

### Acceptance Criteria

- the GM can create a usable empty Campaign by entering only a name
- the GM can switch Campaigns immediately and later resume the exact Running
  Scene, Encounter, and travel state left in each Campaign
- a Session can be manually authored without selecting any Party
- generation uses a Session-owned expected Party selected from the Roster and
  does not change the current table Party
- copying Campaign-specific content into another Campaign creates an
  independently editable object
- a changed reusable definition affects current and future reads without
  changing completed Scene facts
- name-only creation from a Running Scene attaches there by default and exposes
  an opt-out before confirmation
- explicit deletion removes current references and dependent Encounter runtime
  while completed history keeps its fact with an unknown or recoverable-trash
  reference

## Confirmed Workflow: Session Preparation And Supporting Content

### Planning Workspace And Timeline

`Session` is an unnamed, date-independent planning workspace rather than a
Campaign content object. It holds one current plan that the GM may reuse or
replace. The plan is an ordered timeline of expected Scene occurrences. Each
entry may contain notes and reference zero or one location; the same location
may appear in several entries. The GM can add, remove, reorder, and annotate
entries at any time.

Timeline entries are not stored Scenes. A Scene exists only as resumable runtime
state. The primary Running Scene is always available in the Scene tab and only
changes its contents; the GM neither starts nor ends it. Splitting characters
out of that Scene creates additional Running Scenes.

The GM can prepare the complete timeline, monster groups, treasures, and
location placements manually without a planning Party, Adventure Day, name,
date, or generation.

### Assisted Generation

Generation uses a planning-only expected Party selected from the Roster and
does not change the current table Party. It requires an Adventure Day. For the
selected characters and levels, the Adventure Day provides the DMG-guided
Encounter amount, XP budget, and loot budget used to create monster groups and
treasures.

The GM may optionally provide a desired Scene count and select locations,
factions, NPCs, Items, or other Campaign content. Every selected object is a
binding constraint and must occur in the suggested Scenes. SaltMarcher may add
other existing or newly created Campaign content. Before generation it checks
whether all constraints fit the Adventure Day. If not, it explains the conflict
and disables generation instead of producing a partial result.

Generation returns a timeline with concrete monster groups and treasures. The
GM can edit, regenerate, reject, accept, and place each result independently.
Regenerating one result leaves every other result, manual edit, placement, and
timeline change untouched.

### Accepted World Content And Treasures

Placing a monster group or treasure accepts it as persistent World content. It
remains editable and survives replacement of the current plan. Replacing the
plan removes its timeline, timeline notes, and unaccepted drafts without
changing any accepted placement.

When the Party reaches a prepared location, its placed monster groups and
treasures appear in the Running Scene UI. SaltMarcher does not begin combat or
award anything automatically; the GM decides what happens.

A treasure may contain Items, including coins, trade goods, magic Items,
equipment, and other possessions. The GM can independently add, remove,
replace, and edit each Item before or after placement and move Items between
treasures and locations.

### Weather, Music, And Notes

Weather is not Session preparation. It develops autonomously from location
terrain and other available climate data; its live behavior remains part of a
later workflow.

Songs are stored locally. When adding a song, the GM assigns mood, intensity,
vibe tags, and genre and can manage that data later. Scene sliders supply mood
and intensity input; locations, NPCs, factions, monsters, and other Scene
content contribute vibe tags and genres. The exact mood axes and categorization
model remain subject to product testing.

The GM may enable or disable autoplay. When enabled, the currently focused
Running Scene drives the automatically generated music queue. Scene changes
update that queue, and a song that no longer fits fades out gradually. Manual
stop, skip, back, selection, queue, and loop actions take precedence until the
manual choice ends, after which autoplay resumes if still enabled.

Every authored or generated object may carry free-form GM notes. Notes relevant
to a Running Scene are visible and editable there, and the GM can search notes
across every kind of object.

### Acceptance Criteria

- the GM can build all preparation manually in an unnamed, undated planning
  workspace without choosing a Party or using generation
- the GM can freely edit and reorder a timeline whose entries each reference
  zero or one location
- replacing the current plan removes only its timeline and unaccepted work and
  preserves all accepted World placements
- generation remains unavailable with an explanation when its binding inputs
  cannot fit the selected Party's Adventure Day
- a generated monster group or treasure can be changed or regenerated without
  changing any other generated or manual preparation
- reaching a prepared location exposes placed content without starting or
  awarding it automatically
- treasure Items remain individually editable and movable after placement
- weather requires no Session preparation
- the focused Running Scene drives optional autoplay while manual music
  controls take precedence
- the GM can edit relevant notes in a Running Scene and search notes across all
  object kinds

### Runtime Clarification: Scene And Encounter

The primary Running Scene always exists and cannot be paused, completed, closed,
or discarded. Empty Scenes are removed; a remaining populated Scene becomes
primary. If the current Party is empty, all Scenes except one empty primary
Scene are removed. A Scene has zero or one current location. Changing location
changes the NPCs, Features, treasures, monster groups, and other location
content shown in the Scene unless the GM explicitly makes content travel with
the Party or pins it to the Scene. Content that leaves the Scene remains at its
location.

An Encounter is not persistent World content. It is a temporary combat mask
over a Running Scene that selects PCs and NPCs already present there and adds
combat behavior such as HP tracking and initiative. Chase and future mask types
may provide other focused workflows. The Scene remains visible in the main
panel while mask state remains available in its adjacent state panel. Persistent
preparation creates and places monster groups, not Encounters.

## Confirmed Cross-Workflow Behavior

### Complete Encounter Outcome

The GM confirms one complete Encounter outcome. Encounter result and completion,
calculated Party XP, selected named-NPC lifecycle effects, selected finite-stock
effects become effective together or remain wholly unchanged.
The associated Running Scene remains active. Loot persistence is a separate,
still-unconfirmed workflow.

### Authoritative Party With Dependent Running Contexts

Party activation, deactivation, or deletion is authoritative immediately and is
not rolled back by an unavailable Running Scene or Encounter. A later
live-workflow answer supersedes the earlier allowance for an unassigned active
character: every active Party character belongs to exactly one Running Scene,
and activation assigns the character to the currently focused Scene. Inactive
Roster characters belong to no Scene and retain their last location and other
state. Deactivated or deleted characters immediately stop counting as current
Party members.

Only Running Scenes that reference the changed character and their Encounters
reconcile. Until reconciliation succeeds, affected contexts are visibly pending
and stale Encounter context is not presented as synchronized. Initialization,
refresh, and explicit retry resume the saved work without repeating the Party
change. Unaffected contexts do not change.

### Scene Save Before Encounter Synchronization

A valid Running Scene change remains saved and usable when its Encounter cannot
accept the corresponding context. The exact Scene state remains visibly pending,
stale Encounter context is never presented as synchronized, and retry continues
from the saved Scene change.

### Explanatory Campaign History

The GM can inspect an immutable chronological history of meaningful confirmed
Campaign consequences, including campaign-time progression, travel, Encounter
completion, XP, Party membership, NPC or finite-stock effects, and GM
corrections.

A correction appends a linked entry rather than rewriting prior history. The
history is not required to replay the Campaign, reconstruct every intermediate
application state, or restore an arbitrary whole-Campaign snapshot.

## Awaiting Workflow Confirmation

The following areas intentionally contain no normative behavior yet:

- live table workflow outside the confirmed cross-workflow behavior above
- spatial travel and campaign-time progression outside confirmed Dungeon needs
- possessions, loot award, follow-up, and general correction workflows
- import, export, reference refresh, backup, restore, and recovery
- measurable program-wide responsiveness, scale, modular change, removal,
  replacement, and extension needs

## Acceptance Of This Baseline

This document may become `Active Target` only after every interview workflow has
an explicitly confirmed interpretation, every known capability is included,
excluded, or parked, all cross-workflow handoffs have observable desired
behavior, and no unresolved product decision blocks technical-needs derivation.

## References

- [Program Needs Interview Series](../interviews/program-needs/README.md)
- [Program Needs Foundation And Coverage](../interviews/program-needs/2026-07-22-foundation-and-coverage.md)
- [Session And Scene Preparation Interview](../interviews/program-needs/2026-07-22-session-and-scene-preparation.md)
- [Project Vision](../vision.md)
- [Documentation Standard](../documentation.md)
