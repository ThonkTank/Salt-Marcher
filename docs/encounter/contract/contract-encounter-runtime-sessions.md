Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Keyed Encounter runtime-session persistence contract.

# Encounter Runtime Session Contract

## Purpose

Encounter owns one restart-safe runtime session per external context key. Scene
is the first context provider, but the contract contains no Scene-owned types.

## Boundary

`EncounterRuntimeContextApi` synchronizes a revision, focused key, PC IDs,
optional World Planner location ID, and World NPC facts. Synchronization creates,
updates, focuses, and removes keyed sessions idempotently.

## Stored State

The Encounter adapter stores format version, Builder inputs and roster,
generator alternatives and selection, pending undo, active saved-plan reference,
initiative rows, combatants, HP, initiative, round, active turn, result rows,
and XP-award status. Party and World Planner details remain derived foreign
facts and are refreshed on restoration.

Rows are stored as ordered, versioned textual memento sections. Unknown format
versions or malformed rows return a storage error and MUST NOT be overwritten
with an empty session.

## Consistency And Errors

Every Encounter command persists all changed context mementos transactionally.
PC transfers affecting two contexts are saved together. A failed save leaves
the last committed mementos intact. The caller exposes synchronization failure
instead of continuing against stale state.
