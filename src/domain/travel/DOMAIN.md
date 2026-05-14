Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
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

`published/` owns the runtime-travel boundary for active workspaces, workflow
commands, workspace-state readback, and map-projection snapshots.

Published travel carriers must not own:

- authored dungeon invariants
- party roster truth
- render-widget state
- shell lifecycle

## Application Boundary

Application Service: TravelApplicationService

`TravelApplicationService` is the only callable travel backend boundary. It
coordinates runtime dungeon-travel session state through same-context
`travel/application/*UseCase` work. Binder and view code consume the runtime
session through this boundary only; they do not own the session.

The root boundary owns only inbound command/query intake and same-context
use-case routing. Runtime session orchestration lives below that boundary in
`travel/application/*UseCase` code. Concrete party and dungeon adapters are
assembled outside the domain and satisfy the use case through same-context
application data only. Same-context outward state and feedback return only
through read-side `travel.published/*Model` handles.

## Commands And Invariants

Write Model: None

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
- current runtime workspace state is rebuilt from dungeon truth plus party
  position
- party and dungeon carrier translation happens only at the root boundary
- no separate `travel` persistence store is introduced

## Ephemeral Policy Rationale

The interactive travel workspace owns only transient runtime composition over
public party position state and authored dungeon traversal facts. Its decisions
are overlay state, projection level, refresh or action sequencing, and
overworld fallback handling for the current session, not persisted authored
truth. A future durable travel write model would require an explicit new owner
instead of being absorbed into this generation-policy context.

## Ubiquitous Language

- `TravelDungeonSnapshot`: current runtime dungeon-travel session readback
- `TravelDungeonWorkspaceState`: projected runtime workspace state for one
  current position
- `TravelDungeonMapProjectionSnapshot`: projection-only map payload for shared
  map rendering consumers
- `TravelOverlaySettings`: session-local overlay projection controls
