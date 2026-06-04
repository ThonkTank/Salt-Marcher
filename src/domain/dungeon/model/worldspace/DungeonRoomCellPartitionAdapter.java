package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomClusterRoomPartition;

// Remove this bridge when room cell callers use RoomClusterRoomPartition directly.
final class DungeonRoomCellPartitionAdapter {

    private static final DungeonRoomBoundaryPartitionAdapter PARTITION_ADAPTER =
            new DungeonRoomBoundaryPartitionAdapter();

    Map<Long, List<DungeonCell>> cellsByRoom(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            Map<Integer, List<DungeonCell>> cellsByLevel
    ) {
        List<DungeonRoom> safeRooms = rooms == null ? List.of() : rooms;
        Map<Long, List<Cell>> coreCellsByRoom = RoomClusterRoomPartition.cellsByRoom(
                cluster.toCore(cellsByLevel),
                coreRooms(safeRooms),
                PARTITION_ADAPTER.closedBoundaryEdgesByLevel(cluster.boundariesByLevel(), cluster.center()));
        return dungeonCellsByRoom(coreCellsByRoom);
    }

    private static List<Room> coreRooms(List<DungeonRoom> rooms) {
        List<Room> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null) {
                result.add(room.toCore());
            }
        }
        return List.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> dungeonCellsByRoom(Map<Long, List<Cell>> source) {
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Cell>> entry : source.entrySet()) {
            result.put(entry.getKey(), dungeonCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<DungeonCell> dungeonCells(List<Cell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(DungeonCell.fromGeometry(cell));
            }
        }
        return List.copyOf(result);
    }
}
