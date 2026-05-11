package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonRoomCluster;
import src.domain.dungeon.model.map.model.DungeonRoomCellProjection;

public record DungeonRoomTopologyClusterWork(
        DungeonRoomCluster cluster,
        List<DungeonRoom> rooms,
        Map<Integer, List<DungeonCell>> cellsByLevel
) {

    public DungeonRoomTopologyClusterWork {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        cellsByLevel = cellsByLevel == null ? Map.of() : Map.copyOf(cellsByLevel);
    }

    public List<DungeonCell> cellsAt(int level) {
        return cellsByLevel.getOrDefault(level, List.of());
    }

    public List<DungeonCell> allCells() {
        List<DungeonCell> result = new ArrayList<>();
        for (List<DungeonCell> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return DungeonRoomCellProjection.sortedCells(result);
    }

    public DungeonRoomTopologyClusterWork withCellsByLevel(Map<Integer, List<DungeonCell>> nextCellsByLevel) {
        return new DungeonRoomTopologyClusterWork(cluster, rooms, nextCellsByLevel);
    }
}
