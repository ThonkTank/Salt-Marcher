package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellLoopRasterizer;
import src.domain.dungeon.model.core.geometry.CellLoopRasterizer.CellLoop;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomClusterRoomPartition;

public final class DungeonRoomCellProjection {

    public static final Cell LOOP_SEPARATOR = new Cell(Integer.MIN_VALUE, Integer.MIN_VALUE, 0);

    public Map<Long, List<Cell>> cellsByRoom(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        List<DungeonRoom> safeRooms = rooms == null ? List.of() : rooms;
        Map<Integer, List<Cell>> cellsByLevel = cellsByLevel(cluster, safeRooms);
        Map<Long, List<Cell>> partitionedCellsByRoom = RoomClusterRoomPartition.cellsByRoom(
                cluster.toCore(cellsByLevel),
                coreRooms(safeRooms),
                DungeonRoomBoundaryPartitionLogic.closedBoundaryEdgesByLevel(
                        cluster.boundariesByLevel(),
                        cluster.center()));
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
        List<Cell> vertices = cluster.relativeVerticesByLevel().getOrDefault(level, List.of());
        if (!vertices.isEmpty()) {
            return cellsFromRelativeVertices(cluster.center(), level, vertices);
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
        if (center == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return flattenedCells(CellLoopRasterizer.relativeCellLoops(center, nonNullCells(cells)));
    }

    private static Set<Integer> levels(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.add(cluster.center().level());
        levels.addAll(cluster.relativeVerticesByLevel().keySet());
        levels.addAll(cluster.boundariesByLevel().keySet());
        for (DungeonRoom room : rooms) {
            levels.addAll(room.floorAnchors().keySet());
        }
        return levels;
    }

    private static Set<Cell> cellsFromRelativeVertices(
            Cell center,
            int level,
            List<Cell> relativeVertices
    ) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : CellLoopRasterizer.cellsFromRelativeVertices(
                center,
                level,
                coreLoops(relativeVertices))) {
            result.add(cell);
        }
        return Set.copyOf(result);
    }

    private static List<CellLoop> coreLoops(List<Cell> cells) {
        List<CellLoop> loops = new ArrayList<>();
        List<Cell> currentLoop = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (LOOP_SEPARATOR.equals(cell)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(new CellLoop(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            if (cell != null) {
                currentLoop.add(cell);
            }
        }
        if (!currentLoop.isEmpty()) {
            loops.add(new CellLoop(currentLoop));
        }
        return List.copyOf(loops);
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

    private static List<Cell> flattenedCells(List<CellLoop> loops) {
        List<Cell> result = new ArrayList<>();
        List<CellLoop> safeLoops = loops == null ? List.of() : loops;
        boolean separateLoops = safeLoops.size() > 1;
        for (CellLoop loop : safeLoops) {
            for (Cell cell : loop.vertices()) {
                result.add(cell);
            }
            if (separateLoops) {
                result.add(LOOP_SEPARATOR);
            }
        }
        return List.copyOf(result);
    }

}
