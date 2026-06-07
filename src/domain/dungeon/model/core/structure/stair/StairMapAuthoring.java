package src.domain.dungeon.model.core.structure.stair;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorConnectionNormalization;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

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

    public Set<Cell> roomInteriorCells(SpatialTopology topology, RoomCatalog rooms) {
        return roomInteriorQuery.from(topology, rooms);
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
}
