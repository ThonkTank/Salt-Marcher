Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Persistence path and schema ownership rules for the `party`
feature.

# Party Persistence

This document is normative for the `party` feature's persistence path.

## Root Contract

- `src/data/party/PartyServiceContribution.java` is the only root service
  entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers the exported party runtime services through the
  shell-owned service registry, `shell.api.ServiceRegistry`.
- `PartyApplicationService.class` is the party command boundary only. Party
  readback is exported through the published runtime models
  `PartySnapshotModel.class`, `ActivePartyModel.class`,
  `ActivePartyCompositionModel.class`, `AdventuringDaySummaryModel.class`,
  `PartyTravelPositionsModel.class`, `PartyMutationModel.class`, and
  `AdventuringDayCalculationModel.class`.
- Domain ports and other implementation collaborators are implementation
  details and must not be registered as runtime services.
- View assembly code and foreign feature adapters read those services only
  through the shell-owned service lookup on `ShellRuntimeContext.services()`.

## Mandatory Schema

- `src/data/party/model/PartyPersistenceSchema.java` is the canonical in-code
  schema declaration for the feature.
- The schema currently owns:
  - `player_characters`
  - `party_roster_metadata`
- `player_characters` stores character-owned travel columns for dungeon and
  overworld locations plus the party-token attachment flag. These columns are
  part of character state, not a campaign-level travel table and not dungeon
  authored truth.
- `SqlitePartyLocalGateway` must derive table creation and additive column
  migration from this schema artifact instead of spreading canonical
  definitions across unrelated classes.

## Current Mapping

Party persistence stores the character roster, membership, progression, combat
profile, and character-specific runtime travel context in the party write
model. That travel context is represented as scalar references to the owning
space:

- dungeon travel location stores map id, local owner id, local tile coordinate,
  level, location kind, and heading
- overworld travel location stores overworld map id and tile id
- party-token attachment stores whether a character currently follows the
  shared party token position

The data layer maps those columns through source-local party records into
party-domain values. Dungeon persistence remains responsible for authored map
truth only; it does not persist character positions.

## Validation And Error Behavior

- party writes MUST reject malformed character identity, roster, progression,
  or travel-location payloads instead of silently persisting partial character
  truth
- dungeon and overworld travel references MUST be validated as party-owned
  scalar location references rather than expanded into authored map truth
- storage and schema failures MUST surface through party-owned published result
  statuses rather than leaking SQLite exceptions to the view layer

## Stability Rules

- Adding another persistence-exporting feature must not require routine edits
  outside `src/`.
- The party roster write port remains a data-owned collaborator injected into
  `PartyApplicationService`; no feature-specific bootstrap wiring is allowed.
- Legacy runtime-service wiring through `RuntimeServiceProvider` or
  `RuntimeServiceRegistry` is forbidden.
- Character-specific runtime state belongs in party persistence unless another
  bounded context owns the character information itself.
- Foreign features must not depend on party root return values for readback.
  They must use owner-local adapters backed by the exported party models.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject runtime-service exports of domain ports or internal
  collaborators while allowing the party command root plus the published party
  read models.
- Review must reject authored dungeon truth leaking into party-owned
  character-travel persistence.

## References

- [Party Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/domain/domain-party.md:1)
- [Party Dropdown UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/party/requirements/requirements-party-dropdown.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
