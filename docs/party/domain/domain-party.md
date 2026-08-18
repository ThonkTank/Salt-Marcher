# Party Domain Model

## Context Role

Context Role: Party Character State Context
Context Name: Party

- `party` is the Campaign Roster and current-Party character state context.
- Its public boundary is `PartyApi`.
- The feature owns party composition, party membership, XP progression,
  rest-driven mutation rules, and character-specific runtime travel position.

## Published Language

`PartyApi` owns public party commands, results, snapshots, status enums,
membership states, rest carriers, and adventuring-day calculation carriers.
Character
detail snapshots publish current XP, current-level XP floor, next-level XP
threshold, and rest cadence facts so downstream views can render progression
without depending on roster internals.

The party domain MUST NOT depend on API carriers. The application boundary
translates public carriers into roster values before delegating to the model.

## Application Boundary

The application boundary contains party use cases. Use cases load one
`PartyRoster`, delegate mutation or query decisions to the roster model, and
save through a feature-owned persistence port. The application layer publishes
immutable, revisioned API state and mutation feedback through `PartyApi`.

## Write Model

The authored write model is the persisted Campaign Roster and character state:

- stable character identity
- optional player, species, class, ordered language, passive
  Perception, passive Investigation, passive Insight, armor, and movement facts
- explicit current-Party membership state
- XP as the authored progression source, with level derived from the active
  campaign's configurable 20-level XP thresholds
- character-specific travel location and whether that character is attached to
  the party token

## Aggregate Model

Aggregate Root: PartyRoster

`PartyRoster` is the transaction boundary for one party roster. It owns the
character collection, next character identity, optional authored facts,
membership assignment, XP
awards and corrections, and rest-driven progression transitions.

`PartyCharacter` is an identity-bearing child model. The Party domain owns
identity, progress, combat profile, membership, rest type, travel position,
and mutation status vocabulary; package and helper decomposition are internal
implementation choices.

## Commands And Invariants

Commands entering the aggregate are:

- create Roster character
- update character
- delete character
- set membership
- award XP or correct XP with a signed delta
- perform rest
- move characters to a dungeon or overworld travel location

Core invariants:

- character identity remains stable across roster mutations
- character name is the only universal creation requirement; player, species,
  class, languages, passive scores, armor, and movement preserve exact presence
  or absence. Omitted progression begins at XP 0 and therefore level 1.
- character creation always produces an inactive Roster member detached from
  Party travel and Scene participation
- active and reserve membership is owned by the party aggregate, not by view
  state, and changes only through the explicit membership command
- level is derived from XP after awards and signed corrections, including
  automatic level gain and loss across configured thresholds
- the editor's level control is an XP shortcut: leaving the derived level
  unchanged preserves exact XP; choosing another level sets XP to that level's
  configured threshold
- negative XP correction is capped at XP 0 and reduces rest-cadence XP counters
  by the applied correction amount without going below zero
- character-specific travel location is stored with the character, not in a
  campaign-level model, shell session, dungeon map, or presentation model
- the party token is derived from attached character travel state instead of
  being a separate write model
- adventuring-day budget and progress calculations use the XP-derived level and
  party-owned rest-budget policies exposed through Party API read carriers
- external mutation enters through the owning roster aggregate

## Consistency Model

One roster mutation changes one `PartyRoster` aggregate instance and is saved
by the party roster persistence repository. Other contexts consume party state
through `PartyApi` instead of
sharing roster internals.

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

## Architecture Constraints

- party mutation rules stay on the roster model and related pure domain work
- application orchestration remains thin and publishes state through `PartyApi`
- the roster domain remains free of API-carrier dependencies
- character-specific state, including dungeon and overworld travel position,
  stays with the character-owned roster state
- Dungeon travel changes party position through `PartyApi`; shell session state
  and campaign-level models are not alternate owners

## References

- [Party Persistence](../contract/contract-party-persistence.md)
- [Party UI](../requirements/requirements-party-dropdown.md)
