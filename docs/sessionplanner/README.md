Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Entry point and document map for the session planner feature.

# Session Planner Feature Docs

## Purpose

The `sessionplanner` feature owns the authored planning record for one
adventure session. It combines session-local participant references, ordered
encounter references, budget allocations, encounter-day assumptions, and
selection state into one persisted session record.

It does not own party truth, encounter-plan roster truth, creature truth,
generated reward truth, loot truth, or generation rules.

## Document Set

### Requirements

- [Session Planner Requirements](./requirements/requirements-session-planner.md)

### Architecture

- [Session Planner Architecture](./architecture/architecture-session-planner.md)

### Contract

- [Session Planner Persistence Contract](./contract/contract-session-planner-persistence.md)

### Domain

- [Session Planner Domain Model](./domain/domain-session-planner.md)

## Integrations

- [Session Generation Feature](../sessiongeneration/README.md)
- [Encounter Generated Import](../encounter/contract/contract-encounter-generated-import.md)
- Session Planner publishes every prepared scene through a revisioned,
  I/O-free catalog. Scene imports create independent copies; later planner
  edits do not mutate running scenes.

## References

- [Party Feature Overview](../party/README.md) (line 1)
- [Encounter Feature Overview](../encounter/README.md) (line 1)
