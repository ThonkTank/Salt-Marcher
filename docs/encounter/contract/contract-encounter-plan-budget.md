Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-05-10
Source of Truth: API contract for the encounter-owned saved-plan planning
facts consumed by SessionPlanner.

# Encounter Plan Budget Contract

## Purpose

This contract defines the encounter-owned planning surface used by
SessionPlanner to read one saved encounter plan as worker-facing planning
facts.

## Read Surface

- `EncounterApi` provides a typed saved-plan planning operation returning one
  `EncounterPlanFact`

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
- the service does not expose encounter persistence rows directly
- creature XP stays creature-owned and is reloaded through creature detail
  reads instead of being duplicated into encounter-plan persistence
- SessionPlanner consumes the facts through `EncounterApi`, supplied during
  explicit application composition

## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md) (line 1)
