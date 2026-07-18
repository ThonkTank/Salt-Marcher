Status: Active Target
Owner: Session Planner Feature
Last Reviewed: 2026-07-18
Source of Truth: Entry point and document map for the Session Planner feature.

# Session Planner Feature

## Reading Order

1. Read [Requirements](requirements/requirements-session-planner.md) for the
   observable preparation flow and compact workspace.
2. Read [Domain](domain/domain-session-planner.md) for authored truth and
   invariants.
3. Read [Persistence Contract](contract/contract-session-planner-persistence.md)
   for stored references and write behavior.
4. Read [Architecture](architecture/architecture-session-planner.md) for the
   preparation workflow, workspace snapshot, concurrency, and performance
   decisions.
5. Read the temporary
   [Greenfield Roadmap](delivery/roadmap-session-planner-greenfield.md) only
   while implementing or reviewing the replacement. It owns sequence and
   deletion gates, not durable behavior or architecture.

## Document Set

- [Requirements](requirements/requirements-session-planner.md)
- [Domain](domain/domain-session-planner.md)
- [Persistence Contract](contract/contract-session-planner-persistence.md)
- [Architecture](architecture/architecture-session-planner.md)
- [Temporary Greenfield Roadmap](delivery/roadmap-session-planner-greenfield.md)

## Neighboring Owners

- [Session Generation](../sessiongeneration/README.md)
- [Encounter](../encounter/README.md)
- [Party](../party/README.md)
