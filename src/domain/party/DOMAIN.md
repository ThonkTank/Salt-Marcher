Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Party feature ownership, write model, and domain invariants.

# Party Domain Model

## Context Role

Context Role: Roster Truth Context

- `party` is the roster truth context.
- Its public backend boundary is
  `src/domain/party/PartyApplicationService.java`.
- The feature owns party composition, party membership, XP progression, and
  rest-driven mutation rules.

## Published Language

`published/` owns public party commands, results, snapshots, status enums,
membership states, rest carriers, and party snapshots returned by
`PartyApplicationService`.

The `roster/` domain module must not depend on any `src.domain.*.published.*`
carriers. The application boundary translates public carriers into roster
values before delegating to the model.

## Application Boundary

`application/` contains party use cases. Use cases load one `PartyRoster`,
delegate mutation or query decisions to the roster model and policies, save
through the domain-owned outbound port, and map results back into `published/`
carriers.

## Write Model

The authored write model is the persisted party roster:

- stable character identity
- party membership state
- level and XP progression
- combat profile values owned by the party feature

## Aggregate Model

Aggregate Root: PartyRoster

`roster/aggregate/PartyRoster` is the transaction boundary for one party
roster. It owns the character collection, next character identity, membership
assignment, XP awards, and rest-driven progression transitions.

`roster/entity/PartyCharacter` is an identity-bearing child entity. Roster
value objects own identity, progress, combat profile, membership, rest type,
and mutation status vocabulary.

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
the party roster port. Other contexts consume party state through the
application service and exported carriers instead of sharing roster internals.

## Ubiquitous Language

- `PartyRoster`: authored party aggregate.
- `PartyCharacter`: identity-bearing character inside the roster.
- `PartyMembership`: active or reserve participation state.
- `PartyCharacterProgress`: level, XP, and rest-cadence progress.
- `PartyRestType`: short-rest or long-rest roster transition.

## Architecture Status

Current state:

- `roster/` is moving into explicit role subpackages.
- `aggregate/`, `entity/`, `value/`, `policy/`, and `port/` own the
  roster model roles.
- `application/` coordinates port access and published result mapping.

Target state:

- keep party mutation rules on the roster aggregate and related roster policies
- keep root and internal application services thin
- keep roster role packages free of all `src.domain.*.published.*` dependencies

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Party Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/PERSISTENCE.md:1)
- [Party UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/party/UI.md:1)
