Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Runtime travel composition, session ownership, and domain
boundary of the `travel` context.

# Travel Domain Model

## Context Role

Context Role: Generation Policy Context
Context Name: Travel

- `travel` owns runtime travel-session composition
- `travel` combines authored `dungeon` truth with party-owned travel position
- `travel` does not own authored map persistence and does not own party roster
  truth

## Published Language

`published/` owns the runtime-travel boundary for active workspaces and session
state snapshots.

Published travel carriers must not own:

- authored dungeon invariants
- party roster truth
- render-widget state
- shell lifecycle

## Application Boundary

`TravelApplicationService` is the only callable travel backend boundary. It
coordinates runtime dungeon-travel session state through foreign root
application services from `party` and `dungeon`.

## Commands And Invariants

Commands entering the model are:

- load runtime dungeon travel
- apply runtime dungeon travel session changes

Core invariants:

- runtime travel session state is not authored dungeon truth
- runtime travel position is persisted only through the party context
- authored dungeon traversal facts are loaded from the dungeon context only

## Consistency Model

`travel` owns transient runtime session state only.

- overlay settings are session-local
- projection level is session-local
- current runtime dungeon surface is rebuilt from dungeon truth plus party
  position
- no separate `travel` persistence store is introduced

## Ubiquitous Language

- `TravelDungeonSnapshot`: current runtime dungeon-travel session surface
- `TravelDungeonSurface`: projected runtime dungeon surface for one current
  position
- `TravelOverlaySettings`: session-local overlay projection controls
