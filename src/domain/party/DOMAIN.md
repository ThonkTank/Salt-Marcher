Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Party feature ownership, write model, and domain invariants.

# Party Domain Model

## Context Shape

Context Type: Policy-Owning Bounded Context

- `party` is a policy-owning bounded context.
- Its public backend boundary is
  `src/domain/party/PartyApplicationService.java`.
- The feature owns party composition, party membership, XP progression, and
  rest-driven mutation rules.

## Write Model

The authored write model is the persisted party roster:

- stable character identity
- party membership state
- level and XP progression
- combat profile values owned by the party feature

## Core Invariants

- character identity remains stable across roster mutations
- active and reserve membership is owned by the party aggregate, not by view
  state
- XP and level progression remain internally consistent after award and rest
  operations
- external mutation enters through the owning roster aggregate

## Architecture Status

Current state:

- `PartyRoster` already carries a substantial share of party mutation behavior
  directly in the `roster/` domain module.
- `roster/` owns the party aggregate, repository contract, membership, XP, and
  rest policy types.
- `application/` mainly coordinates repository access and exported result
  mapping.

Target state:

- keep party mutation rules on the roster aggregate and related roster policies
- keep root and internal application services thin

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Party Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/PERSISTENCE.md:1)
- [Party UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/party/UI.md:1)
