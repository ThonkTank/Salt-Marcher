package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellLoopSequence;
import src.domain.dungeon.model.core.geometry.CellOrdering;

public final class RoomCellCoverage {

    public static final Cell LOOP_SEPARATOR = CellLoopSequence.LOOP_SEPARATOR;

    public Map<Long, List<Cell>> cellsByRoom(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        List<DungeonRoom> safeRooms = rooms == null ? List.of() : rooms;
        Map<Integer, List<Cell>> cellsByLevel = cellsByLevel(cluster, safeRooms);
        Map<Long, List<Cell>> partitionedCellsByRoom = RoomClusterRoomPartition.cellsByRoom(
                cluster.toCore(cellsByLevel),
                coreRooms(safeRooms),
                cluster.closedBoundaryEdgesByLevel());
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Cell>> entry : partitionedCellsByRoom.entrySet()) {
            result.put(entry.getKey(), nonNullCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    public Map<Integer, List<Cell>> cellsByLevel(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Integer level : levels(cluster, rooms)) {
            result.put(level, CellOrdering.sortedCells(clusterCells(cluster, rooms, level)));
        }
        return Map.copyOf(result);
    }

    public Set<Cell> clusterCells(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            int level
    ) {
        List<Cell> floorCells = cluster.cellsByLevel().getOrDefault(level, List.of());
        if (!floorCells.isEmpty()) {
            return Set.copyOf(floorCells);
        }
        Set<Cell> anchors = new LinkedHashSet<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            Cell anchor = room.floorAnchors().get(level);
            if (anchor != null) {
                anchors.add(anchor);
            }
        }
        if (anchors.isEmpty()) {
            anchors.add(new Cell(cluster.center().q(), cluster.center().r(), level));
        }
        return anchors;
    }

    public List<Cell> relativeCellLoops(Cell center, List<Cell> cells) {
        return CellLoopSequence.relativeCellLoopVertices(center, cells);
    }

    private static Set<Integer> levels(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.add(cluster.center().level());
        levels.addAll(cluster.cellsByLevel().keySet());
        levels.addAll(cluster.boundaryLevels());
        for (DungeonRoom room : rooms) {
            levels.addAll(room.floorAnchors().keySet());
        }
        return levels;
    }

    private static List<Cell> nonNullCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
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

}
