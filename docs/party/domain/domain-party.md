Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Party feature ownership, write model, and domain invariants.

# Party Domain Model

## Context Role

Context Role: Party Character State Context
Context Name: Party

- `party` is the party character state context.
- Its public backend boundary is
  `src/domain/party/PartyApplicationService.java`.
- The feature owns party composition, party membership, XP progression,
  rest-driven mutation rules, and character-specific runtime travel position.

## Published Language

`published/` owns public party commands, results, snapshots, status enums,
membership states, rest carriers, adventuring-day calculation carriers, and
party snapshots returned by `PartyApplicationService`. Character detail
snapshots publish current XP, current-level XP floor, next-level XP threshold,
and rest cadence facts so downstream views can render progression without
depending on roster internals.

The `roster/` domain module must not depend on any `src.domain.*.published.*`
carriers. The application boundary translates public carriers into roster
values before delegating to the model.

## Application Boundary

`application/` contains party use cases. Use cases load one `PartyRoster`,
delegate mutation or query decisions to the roster model and policies, save
through the domain-owned outbound port, and return application/model results
to the root application service for `published/` mapping.

## Write Model

The authored write model is the persisted party roster and character state:

- stable character identity
- party membership state
- level and XP progression
- combat profile values owned by the party feature
- character-specific travel location and whether that character is attached to
  the party token

## Aggregate Model

Aggregate Root: PartyRoster

`roster/aggregate/PartyRoster` is the transaction boundary for one party
roster. It owns the character collection, next character identity, membership
assignment, XP awards and corrections, and rest-driven progression
transitions.

`roster/entity/PartyCharacter` is an identity-bearing child entity. Roster
value objects own identity, progress, combat profile, membership, rest type,
travel position, and mutation status vocabulary.

## Commands And Invariants

Commands entering the aggregate are:

- create character
- update character
- delete character
- set membership
- award XP or correct XP with a signed delta
- perform rest
- move characters to a dungeon or overworld travel location

Core invariants:

- character identity remains stable across roster mutations
- active and reserve membership is owned by the party aggregate, not by view
  state
- XP and level progression remain internally consistent after award, signed
  correction, and rest operations
- negative XP correction is capped at the current level's XP floor and reduces
  rest-cadence XP counters by the applied correction amount without going below
  zero
- character-specific travel location is stored with the character, not in a
  campaign-level model, shell session, dungeon map, or view model
- the party token is derived from attached character travel state instead of
  being a separate write model
- adventuring-day budget and progress calculations use party-owned level and
  rest-budget policies and are exposed through published read carriers
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
- `PartyCharacterTravelState`: character-owned runtime travel state and party
  token attachment.
- `PartyTravelLocation`: character travel target in a dungeon or overworld
  space.
- `PartyRestType`: short-rest or long-rest roster transition.

## Architecture Status

Current state:

- `roster/` is moving into explicit role subpackages.
- `aggregate/`, `entity/`, `value/`, `policy/`, and `port/` own the
  roster model roles.
- `application/` coordinates port access and returns application/model results
  to the root boundary.
- Dungeon travel now persists active character positions through the party
  application boundary instead of storing them in shell runtime session state
  or a campaign-level model.

Target state:

- keep party mutation rules on the roster aggregate and related roster policies
- keep root and internal application services thin
- keep roster role packages free of all `src.domain.*.published.*` dependencies
- keep character-specific state, including dungeon and overworld travel
  position, with the character aggregate state

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Party Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/contract/contract-party-persistence.md:1)
- [Party UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/requirements/requirements-party-dropdown.md:1)
