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

## Confirmed Cross-Workflow Behavior

### Complete Encounter Outcome

The GM confirms one complete Encounter outcome. Encounter result and completion,
calculated Party XP, selected named-NPC lifecycle effects, selected finite-stock
effects become effective together or remain wholly unchanged.
The associated Running Scene remains active. Loot persistence is a separate,
still-unconfirmed workflow.

### Authoritative Party With Dependent Running Contexts

Party activation, deactivation, or deletion is authoritative immediately and is
not rolled back by an unavailable Running Scene or Encounter. Activation creates
no automatic Scene assignment. Deactivated or deleted characters immediately
stop counting as current Party members.

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

- session and Scene preparation, Encounter and reward generation, planned
  weather, music, and notes
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
