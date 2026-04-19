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

## Aggregate Model

Aggregate Root: PartyRoster

`PartyRoster` is the transaction boundary for one party roster. It owns the
character collection, next character identity, membership assignment, XP awards,
and rest-driven progression transitions. `PartyCharacter` is an entity inside
that aggregate, and roster value objects own identity, progress, combat profile,
membership, rest type, and mutation status vocabulary.

## Commands And Invariants

Commands entering the aggregate are:

- create character
- update character
- delete character
- set membership
- award XP
- perform rest

Core invariants:

- character identity remains stable across roster mutations
- active and reserve membership is owned by the party aggregate, not by view
  state
- XP and level progression remain internally consistent after award and rest
  operations
- external mutation enters through the owning roster aggregate

## Consistency Model

One roster mutation changes one `PartyRoster` aggregate instance and is saved by
the party repository contract. Other contexts consume party state through the
application service and exported read carriers instead of sharing roster
internals.

## Ubiquitous Language

- `PartyRoster`: authored party aggregate.
- `PartyCharacter`: identity-bearing character inside the roster.
- `PartyMembership`: active or reserve participation state.
- `PartyCharacterProgress`: level, XP, and rest-cadence progress.
- `PartyRestType`: short-rest or long-rest roster transition.

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

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Party Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/PERSISTENCE.md:1)
- [Party UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/party/UI.md:1)
