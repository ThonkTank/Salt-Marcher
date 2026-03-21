# Dungeon Map Architecture

`dungeonmap/model` is now split into three explicit layers:

- `model/geometry`
  Primitive map geometry such as `Point2i`, `Tile`, `TileShape`, `VertexEdge`, `VertexPath`, `GridAnchor`, and `GridRoute`.
- `model/objects`
  Self-managed map objects such as `Floor`, `BoundaryObject`, `Wall`, `Door`, and `CorridorPath`.
- `model/structures`
  Self-managed structures such as `Room`, `Corridor`, and `RoomCluster`.

`model/DungeonLayout` remains the thin global lookup layer over already-built structures.

## Dependency Direction

- Geometry knows nothing about objects, structures, loading, or rendering.
- Geometry owns all reusable mathematical truth. If logic still makes sense after removing words like "door", "wall", "room", or "corridor", it belongs here.
- Objects depend on geometry and should ideally inherit from one fitting geometry primitive. Objects add only object/runtime semantics such as traversal state or barrier behavior; they must not duplicate geometry helpers that already belong to `geometry/`.
- `Tile` is the square-cell primitive for tile-local translation, cardinal adjacency, edge/vertex derivation, and stable cell identity, so `TileShape` and renderers do not need to hand-roll that math.
- Structures depend on objects and own only their own structure-level runtime behavior, composition, and structure-specific bindings.
- Loaders and renderers should prefer `structures` and only touch `objects`/`geometry` when they need geometric detail.

## Layer Rules

- `geometry/` is the only layer allowed to define reusable geometric primitives and general-purpose geometric operations.
- `objects/` should stay thin. A type in `objects/` should usually read like "primitive geometry + one domain rule".
- `structures/` may query geometry and objects, but should not re-implement primitive math or object semantics.
- If a helper is needed by more than one object or structure and is still domain-agnostic, move it down into `geometry/` instead of cloning it upward.
- If behavior depends on runtime state like open/closed/locked, it belongs in `objects/`, not `geometry/`.
- Each query should have exactly one canonical owner on the lowest sensible layer. Do not mirror the same query across `geometry/`, `objects/`, and `structures/` as convenience duplicates.
- If multiple walls/doors must be treated as one geometric thing, introduce or reuse a `geometry/` type such as `BoundaryNetwork` instead of recomputing combined edge topology inside a structure.
- If multiple wall/door kinds must be treated as one semantic thing, use a shared `objects/` surface such as `BoundaryObject` instead of collapsing back to raw `VertexPath`.
- Corridor bindings are canonical structure truth. Absolute corridor route/floor/door geometry is runtime state derived from bindings plus the current room/cluster layout.
- `Room` is the canonical owner of room-local topology truth. If floor shape and boundary objects must be reconciled, normalized, or completed, do that in `structures/room`, not in loaders, renderers, services, or `RoomCluster`.
- `RoomCluster` owns only multi-room facts such as grouping, adjacency, partition validity, simple room merge/split planning, and cluster-local lookup. Do not make `RoomCluster` a second owner of single-room boundary reconstruction.
- Application services may choose between structure capabilities and persist the resulting edit plan, but they must not derive room topology truth themselves from raw `TileShape`, walls, or doors.
- Observable transient feature state belongs in `state/`. Do not scatter reusable `*State` holders for selection, preview, session, loading, or similar editor/runtime state across `shell/`, `canvas/`, or control packages. Keep `state/` as the single discovery location for feature-level transient state containers with listeners or cross-class coordination. Small private controller/widget internals that are not shared state, such as a current drag session, focused field, or temporary button-disable flag, may stay local to the owning class.

## Primitive APIs

- `Point2i`
  Foundation point/vector type for the whole grid model.
  Core APIs: `add`, `subtract`, `translate`, `distanceTo`, `neighbors4`, `isAdjacent4`, `directionToCardinal`, `encodedKey`.
  Shared constants: `POINT_ORDER`, `CARDINAL_STEPS`.

- `Tile`
  Primitive square tile with tile-local geometry and adjacency semantics.
  Core APIs: `translated`, `relativeTo`, `neighbor`, `neighbors4`, `isAdjacentTo`, `directionTo`, `edge`, `sharedEdge`, `vertices`, `distanceTo`, `encodedKey`.
  Shared helpers: `translateAll`, `positions`, `bestCenterTile`, `encode`.

- `TileShape`
  Primitive tile-area object with one canonical truth: `anchor + relative tiles`.
  Core APIs: `anchor`, `relativeTiles`, `relativeCells`, `tiles`, `absoluteCells`, `contains`, `size`, `isSingleTile`, `overlaps`, `touches`, `union`, `intersect`, `subtract`, `minX/maxX/minY/maxY`, `centerCell`, `isConnected`, `connectedComponents`, `boundaryEdges`, `outlineLoops`, `outerLoop`, `absoluteVertices`, `recentered`, `translated`.
  Constructors: `singleCell`, `fromAbsoluteCells`, `fromAbsoluteTiles`.

- `VertexEdge`
  Primitive undirected edge between two grid vertices with local geometry and tile-facing knowledge.
  Core APIs: `touches(Point2i)`, `touches(VertexEdge)`, `sharedVertex`, `other`, `isHorizontal`, `isVertical`, `isCollinearWith`, `canMergeWith`, `mergedWith`, `touches(Tile)`, `touchesCell`, `touchingTiles`, `touchingCells`, `directionFrom`, `oppositeTile`, `separates`, `translated`, `encodedKey`.
  Shared helpers: `betweenCellAndStep`, `betweenTiles`, `EDGE_ORDER`.

- `VertexPath`
  Primitive path object over canonicalized `VertexEdge` sets. Owns path topology and cell-side boundary geometry, not traversal semantics.
  Core APIs: `edges`, `vertices`, `endpoints`, `branchVertices`, `degreeOf`, `edgesTouching`, `containsEdge`, `touchesVertex`, `touchesEdge`, `touches(VertexPath)`, `touches(Tile)`, `touchesCell`, `touches(TileShape)`, `touchingTiles`, `touchingCells`, `isConnected`, `isLoop`, `orderedChains`, `crosses`, `separates`, `translated`, `withAddedEdges`, `withRemovedEdges`.

- `BoundaryNetwork`
  Primitive combined boundary geometry over multiple `VertexPath`s. It is a specialized `VertexPath`, so combined boundary networks inherit the full shared path API instead of mirroring it through a wrapper.
  Core APIs: inherited `VertexPath` geometry plus `fromPaths`, `mergedWith`.

- `GridAnchor`
  Primitive route anchor that can live on a tile center, vertex, or edge center without floating-point math.
  Core APIs: `kind`, `doubledGridPoint`, `translated`.
  Constructors: `atTile`, `atVertex`, `atEdge`.

- `GridRoute`
  Primitive ordered guide route over `GridAnchor`s. Owns route order and lightweight route editing, not committed corridor rasterization.
  Core APIs: `anchors`, `start`, `end`, `waypoints`, `segments`, `anchorCount`, `isLoop`, `isOrthogonal`, `containsAnchor`, `containsKind`, `translated`, `reversed`, `withInsertedAnchor`, `withMovedAnchor`, `withRemovedAnchor`.

## Object APIs

- `Floor`
  Area object over `TileShape`. It exists so structures own an area object rather than a naked geometry primitive.
  Core APIs: `shape`, `translated`, `withShape`.

- `BoundaryObject`
  Minimal shared object surface for room boundaries. It exists so structures can treat `Wall` and `Door` polymorphically without falling back to raw geometry primitives or re-expressing barrier semantics themselves.
  Core APIs: `path`, `blocksTraversal`.

- `Wall`
  Path-shaped barrier object over `VertexPath`. Geometry is inherited; the object adds only the rule that traversal is blocked.
  Core APIs: inherited `VertexPath` geometry plus `path`, `blocksTraversal`.

- `Door`
  Path-shaped opening object over `VertexPath`. Geometry is inherited; the object adds traversal state.
  Core APIs: inherited `VertexPath` geometry plus `path`, `traversalState`, `blocksTraversal`, `isPassable`, `isOpen`, `isClosed`, `isLocked`, `withTraversalState`.

- `CorridorPath`
  Runtime-owned resolved corridor path object. It holds the current guide route, committed corridor floor, resolved corridor doors, and routing status for one corridor.
  Core APIs: `route`, `floor`, `doors`, `cells`, `contains`, `directlyAdjacent`, `routable`, `withRoute`, `withFloor`, `withDoors`, `withRuntimeGeometry`, `empty`.

## Structure APIs

- `Room`
  Smallest self-managed structure: one `Floor` object plus boundary objects. Structures should compose objects instead of holding raw geometry primitives directly. Combined boundary geometry is exposed as a `BoundaryNetwork`, while traversal remains a room-level rule because it combines geometry with object semantics.
  Core APIs: `create`, `resolved`, `floor`, `walls`, `doors`, `boundaryObjects`, `boundaryNetwork`, `boundaryEdges`, `hasBoundaryEdge`, `cells`, `contains`, `blocks`, `wallsTouching`, `doorsTouching`, `boundaryObjectsTouching`.

- `RoomCluster`
  Self-managed grouping and topology structure over rooms. Room truth lives in the rooms; cluster shape and topology are derived runtime views.
  Core APIs: `center`, `rooms`, `withRooms`, `findRoom`, `singleRoom`, `roomIds`, `containsRoom`, `withAddedRoom`, `withRemovedRoom`, `withReplacedRoom`, `createRoom`, `withCreatedRoom`, `mergedRoom`, `withMergedRooms`, `canMergeRooms`, `cells`, `shape`, `overlaps`, `roomAt`, `contains`, `adjacentRooms`, `adjacentRoomIds`, `components`, `componentContaining`, `isConnected`, `hasOverlappingRooms`, `coversExactlyKnownCells`, `isValidPartition`, `simplePaintExpansion`, `simpleDelete`.

- `Corridor`
  Self-managed corridor structure with ordered room membership, canonical relative bindings, and resolved runtime path state.
  Core APIs: `roomIds`, `bindings`, `path`, `roomLinks`, `connectsRoom`, `withRoomIds`, `withBindings`, `withPath`, `replanned`, `resolvedRooms`, `resolvedWaypointCells`, `resolvedDoorBindings`.

- `CorridorPlanningInput`
  Minimal external planning facts for a self-managed corridor. It provides only raw room and cluster-center lookup, so corridor-specific resolution stays on `Corridor` instead of drifting into a second mirrored planning API.
  Core APIs: `roomsById`, `clusterCenters`, `room`, `clusterCenter`.

- `CorridorBindings`
  Canonical editable corridor bindings. Bindings stay relative so they remain stable when clusters or rooms move.
  Core APIs: `waypoints`, `doorBindings`, `empty`.

- `CorridorWaypointBinding`
  Relative waypoint binding to one cluster center.
  Core APIs: `clusterId`, `relativeCell`, `absoluteCell`, `rebind`.

- `CorridorDoorBinding`
  Relative door binding pinned to one room edge.
  Core APIs: `roomId`, `clusterId`, `relativeCell`, `direction`, `absoluteCell`, `rebind`.

- `ResolvedCorridorDoorBinding`
  Runtime-resolved absolute door binding for one corridor endpoint.
  Core APIs: `absoluteCell`, `direction`.

- `CorridorNetwork`
  Derived runtime grouping of routable corridors that touch by floor cells or corridor doors.
  Core APIs: `networkId`, `corridorIds`, `roomIds`, `floor`, `doors`, `containsCorridor`, `containsRoom`, `buildNetworks`.

- `DungeonLayout`
  Thin global aggregation/query surface over self-managed structures.
  Core APIs: `rooms`, `corridors`, `clusters`, `corridorNetworks`, `findRoom`, `findCorridor`, `findCluster`, `corridorNetworkForCorridor`, `clusterForRoom`, `overlappingClusters`, `hasDependentCorridors`, `roomAtCell`, `clusterAtCell`, `corridorsAtCell`, `corridorNetworkAtCell`.
