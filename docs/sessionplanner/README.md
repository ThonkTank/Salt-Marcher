Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-06
Source of Truth: Entry point and document map for the session planner feature.

# Session Planner Feature Docs

## Purpose

The `sessionplanner` feature owns the authored planning record for one
adventure session. It combines session-local participant references, ordered
encounter references, budget allocations, encounter-day assumptions, and
selection state into one persisted session record.

It does not own party truth, encounter-plan roster truth, creature truth,
loot truth, or gold-economy rules.

## Document Set

### Requirements

- [Session Planner Requirements](./requirements/requirements-session-planner.md)

### Architecture

- [Session Planner Architecture](./architecture/architecture-session-planner.md)

### Contract

- [Session Planner Persistence Contract](./contract/contract-session-planner-persistence.md)

### Domain

- [Session Planner Domain Model](./domain/domain-session-planner.md)

## References

- [Party Feature Overview](docs/party/README.md:1)
- [Encounter Feature Overview](docs/encounter/README.md:1)
