# Dungeon Map Architecture

`dungeonmap/model` is now split into three explicit layers:

- `model/geometry`
  Primitive map geometry such as `Point2i`, `VertexPath`, and `TileShape`.
- `model/objects`
  Anchored map objects such as `DungeonObject`, `Tile`, `Square`, and `Door`.
- `model/structures`
  Domain structures such as `Room`, `Corridor`, and `RoomCluster`, each defined through objects.

`model/DungeonLayout` remains the thin global lookup layer over already-built structures.

## Dependency Direction

- Geometry knows nothing about objects, structures, loading, or rendering.
- Objects depend on geometry and expose anchored absolute map state.
- Structures depend on objects and own dungeon-specific runtime behavior.
- Loaders and renderers should prefer `structures` and only touch `objects`/`geometry` when they need geometric detail.

## Transitional Note

The previous `model/base`, `model/cluster`, and `model/corridor` packages are still present as compatibility leftovers while the rest of the feature catches up. New work should target `geometry`, `objects`, and `structures`.
