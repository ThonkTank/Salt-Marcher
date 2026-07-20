package features.dungeon.domain.core.structure.stair;

import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorConnectionNormalization;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

/**
 * Owns aggregate-level stair authoring inside the core stair structure.
 */
public final class StairMapAuthoring {
    private final StairRoomInteriorQuery roomInteriorQuery = new StairRoomInteriorQuery();
    private final CorridorConnectionNormalization connectionNormalization = new CorridorConnectionNormalization();

    public DungeonMap moveAnchor(
            DungeonMap dungeonMap,
            long stairId,
            int handleIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        StairCollection nextStairs = dungeonMap.stairs().withMovedHandle(
                stairId,
                handleIndex,
                deltaQ,
                deltaR,
                deltaLevel);
        return nextStairs.equals(dungeonMap.stairs())
                ? dungeonMap
                : copyWithConnections(dungeonMap, dungeonMap.corridors(), nextStairs);
    }

    public boolean canCreateAuthoredStair(
            DungeonMap dungeonMap,
            StairGeometrySpec spec
    ) {
        return dungeonMap.stairs().canCreateAuthoredStairGeometry(
                spec,
                roomInteriorCells(dungeonMap));
    }

    public boolean canSaveStairGeometry(
            DungeonMap dungeonMap,
            long stairId,
            StairGeometrySpec spec
    ) {
        return dungeonMap.stairs().canRecomputeAuthoredStair(
                stairId,
                spec,
                roomInteriorCells(dungeonMap));
    }

    private DungeonMap copyWithConnections(
            DungeonMap dungeonMap,
            List<Corridor> nextCorridors,
            StairCollection nextStairs
    ) {
        return connectionNormalization.copyWithConnections(
                dungeonMap,
                nextCorridors,
                nextStairs,
                dungeonMap.transitionCatalog());
    }

    private Set<Cell> roomInteriorCells(DungeonMap dungeonMap) {
        return roomInteriorCells(dungeonMap.topology(), dungeonMap.rooms());
    }

    private Set<Cell> roomInteriorCells(SpatialTopology topology, RoomCatalog rooms) {
        return roomInteriorQuery.from(topology, rooms);
    }
}
