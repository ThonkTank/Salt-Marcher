# Travel Provider Port

## Boundary

`TravelProviderPort<P, S, M, E>` is renderer-local. It is not an IPC contract
and does not weaken the aggregate-specific operations in
`src/shared/contracts/operations.ts`. A provider implements bounded context and
map reads, evaluation, commands, projection description, authored-position
checks, invalidation subscription, and disposal.

The controller sees only provider-generic commands: position, start,
pause/resume, abort, and multiplier. Commands carry object-shaped inputs and
the relevant optimistic revision. Provider adapters translate them into their
own validated capability calls.

## Hex Adapter

The Hex adapter owns a transient `HexMapProjectionPort`, which in turn owns its
`HexChunkCache`, Hex catalog and biome supporting data, exact invalidation, and
disposal. Placement uses that same map-projection contract with either its own
transient cache or the Hex editor's explicit `shared-owner` lifetime. The
travel adapter projects a provider descriptor containing revision, status, map
options, current map and position, and multiplier. Session and Travel never
import Hex persistence or route algorithms.

Hex route evaluation is a discriminated result:

- `ready` contains path, game duration, travel cost, speed, and assumptions;
- `rejected` contains a stable reason code, optional blocking coordinate,
  partial path, speed, and assumptions.

German UI text is renderer-owned and selected from the rejection or travel
hint code. The utility process never returns localized Hex-travel display
messages.

## Lifecycle

The Workspace integration loads the current adapter only when the Session map
or Reise scenario is active. Deactivation cancels request generations and
subscriptions without inventing a persisted Travel aggregate. Context, map,
and evaluation reads have independent generations so a late result cannot
replace a newer selection.

Successful Hex mutations return `{ travel, session }` from the same utility
operation. Both projections describe one committed command boundary; an extra
renderer Session read is forbidden.

Dungeon remains future work. Adding it requires a real adapter and acceptance
cases; no placeholder branch or speculative persistence contract exists.
