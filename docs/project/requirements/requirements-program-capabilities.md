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

- Campaign foundation, switching, reusable reference knowledge, and authored
  Campaign knowledge
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
- [Project Vision](../vision.md)
- [Documentation Standard](../documentation.md)
