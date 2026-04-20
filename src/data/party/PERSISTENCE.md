Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Persistence path and schema ownership rules for the `party`
feature.

# Party Persistence

This document is normative for the `party` feature's persistence path.

## Root Contract

- `src/data/party/PartyServiceContribution.java` is the only root service
  entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers all exported backend capabilities through the
  shell-owned service registry, `shell.api.ServiceRegistry`.
- The exported party runtime surface is `PartyApplicationService.class`.
  Domain ports and nested application-service factories are implementation
  details and must not be registered as runtime services.
- View assembly code reads those capabilities only through the shell-owned
  runtime-capability lookup on `ShellRuntimeContext.services()`.

## Mandatory Schema

- `src/data/party/model/PartyPersistenceSchema.java` is the canonical in-code
  schema declaration for the feature.
- The schema currently owns:
  - `player_characters`
  - `party_roster_metadata`
- `SqlitePartyLocalGateway` must derive table creation and additive column
  migration from this schema artifact instead of spreading canonical
  definitions across unrelated classes.

## Stability Rules

- Adding another persistence-exporting feature must not require routine edits
  outside `src/`.
- The party roster write port remains a data-owned collaborator injected into
  `PartyApplicationService`; no feature-specific bootstrap wiring is allowed.
- Legacy runtime-service wiring through `RuntimeServiceProvider` or
  `RuntimeServiceRegistry` is forbidden.
