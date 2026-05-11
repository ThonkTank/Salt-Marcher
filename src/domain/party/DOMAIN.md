Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Compatibility mirror for canonical documentation at `docs/party/domain/domain-party.md`.

# Party Domain Model Compatibility Mirror

This legacy path remains build-visible during the documentation-taxonomy
migration. Canonical feature-owned documentation lives at:

- [Party Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/domain/domain-party.md:1)

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
published read models exported by the party runtime surface.

## Application Boundary

Application Service: PartyApplicationService

`application/` contains party use cases and party-owned boundary projection.
Use cases load one `PartyRoster`, delegate mutation or query decisions to the
roster model, save through the domain-owned roster persistence repository, and
coordinate exported read-model refresh through the separate party
published-state repository.

## Aggregate Model

Aggregate Root: PartyRoster

`PartyRoster` is the transaction boundary for one party roster. It owns the
character collection, next character identity, membership assignment, XP
awards and corrections, and rest-driven progression transitions.

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
- character-specific travel location is stored with the character, not in a
  campaign-level model, shell session, dungeon map, or view model

## Consistency Model

One roster mutation changes one `PartyRoster` aggregate instance and is saved
by the party roster persistence repository. Other contexts consume party state
through the party command boundary and exported party models instead of
sharing roster internals.

## Ubiquitous Language

- `PartyRoster`: authored party aggregate.
- `PartyCharacter`: identity-bearing character inside the roster.
- `MembershipState`: active or reserve participation state.
- `PartyCharacterProgress`: level, XP, and rest-cadence progress.

## References

- [Party Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/domain/domain-party.md:1)
