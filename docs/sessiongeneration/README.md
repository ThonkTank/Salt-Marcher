Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Entry point and document map for the Session Generation
feature.

# Session Generation Feature Docs

## Purpose

`sessiongeneration` owns deterministic encounter-and-reward generation from a
normalized party-level request and an immutable reference-catalog snapshot. It
publishes generation previews and stored generation results. It does not own
Session Planner records, party members, creature statblocks, or saved Encounter
plans.

## Document Set

- [Requirements](requirements/requirements-session-generation.md)
- [Domain Model](domain/domain-session-generation.md)
- [API And Persistence Contract](contract/contract-session-generation.md)
- [Architecture](architecture/architecture-session-generation.md)

## Neighboring Owners

- [Session Planner](../sessionplanner/README.md)
- [Encounter](../encounter/README.md)
- [Source Architecture](../project/architecture/source-architecture.md)
