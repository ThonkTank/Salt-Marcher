# Encounter Plan Budget Contract

Status: Active target contract; Godot planning route not yet implemented
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose

This contract defines the encounter-owned planning surface used by
SessionPlanner to read one saved encounter plan as worker-facing planning
facts.

## Read Surface

- the target Godot Encounter application boundary provides a typed saved-plan
  planning operation returning one `EncounterPlanFact`

## Payload

- `EncounterPlanFact`
  returns availability, saved-plan identity, label, creature count, total base
  XP, adjusted XP, multiplier, difficulty label, and status text

## Status Semantics

- `available = true`
  the saved plan and active party were available and a planning fact was
  produced
- `available = false`
  the saved plan, party data, or required creature detail could not be loaded,
  or the plan id was invalid or missing

## Boundary Rules

- the planning payload is read-only
- the service does not expose Encounter owner-partition documents directly
- creature XP stays creature-owned and is reloaded through creature detail
  reads instead of being duplicated into encounter-plan persistence
- Session Planner consumes the facts through the Encounter application
  boundary supplied during explicit Godot composition

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md) (line 1)
