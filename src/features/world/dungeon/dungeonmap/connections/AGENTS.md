# AGENTS.md

## Purpose

`connections` owns shared dungeon-map traversal semantics for links that let the party cross between endpoints even when the physical carrier spans an otherwise non-passable boundary or surface discontinuity.

## Canonical Types and APIs

- `ConnectionsObject` — public root owner seam for shared connection semantics.
- `input/Connection`, `input/DungeonConnection` — canonical semantic connection value types — carry endpoints, traversal meaning, and context-resolved entry/exit behavior.
- `input/ConnectionEndpoint`, `input/ConnectionEndpointType`, `input/ConnectionKind` — canonical endpoint and role vocabulary shared by cluster, corridor, runtime, and transition flows.
- `input/ConnectionCarrier`, `input/DoorConnectionCarrier`, `input/StairConnectionCarrier` — physical-carrier descriptors used by semantic connections without re-homing door or stair ownership.
- `input/ConnectionTraversalTarget` — resolved traversal destination carrier for runtime movement.
- `input/DoorExitCatalog`, `input/DoorExitDescriptor` — shared exit-description helpers over connection lists.

## Where New Code Goes

- Put shared connection semantics, endpoint vocabulary, traversal-target resolution, and exit-description helpers here.
- Put cross-owner connection carriers in `input/` so other owners can consume them without reaching into non-public connection internals.
- Keep physical carrier ownership on `structure/model/boundary/door` and the `stair` owner; this owner may reference those carriers but must not absorb their edit or persistence invariants.
- Keep owner-specific connection derivation on the owning aggregate or workflow: room-local connections on `StructureRoomGraph`, corridor connections on `Corridor`, and transition-local connections on transition workflows.
- Keep map-level indexing and lookup orchestration on `DungeonMap`; this owner defines the shared connection value family, not a second map snapshot.

## Forbidden Drift

- Do not move `Door`, `DoorRef`, `Stair`, `DungeonStair`, or `StairExit` into this owner.
- Do not turn this owner into a second structure, room-topology, or map-loading owner.
- Do not move cluster-, corridor-, or transition-specific placement workflows here just because they emit `Connection` values.
