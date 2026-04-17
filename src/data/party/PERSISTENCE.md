Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Persistence path and schema ownership rules for the `party`
feature.

# Party Persistence

This document is normative for the `party` feature's persistence path.

## Root Contract

- `src/data/party/PartyPersistenceContribution.java` is the only root
  persistence entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers all exported persistence capabilities through
  `shell.host.PersistenceRegistry`.
- View code reads those capabilities only through
  `ShellRuntimeContext.persistence()`.

## Mandatory Schema

- `src/data/party/model/PartyPersistenceSchema.java` is the canonical in-code
  schema declaration for the feature.
- The schema currently owns:
  - `player_characters`
  - `party_roster_metadata`
- `SqlitePartyLocalDataSource` must derive table creation and additive column
  migration from this schema artifact instead of spreading canonical
  definitions across unrelated classes.

## Stability Rules

- Adding another persistence-exporting feature must not require routine edits
  outside `src/`.
- The party repository remains registered passively; no feature-specific
  bootstrap wiring is allowed.
- Legacy runtime-service wiring through `RuntimeServiceProvider` or
  `RuntimeServiceRegistry` is forbidden.
