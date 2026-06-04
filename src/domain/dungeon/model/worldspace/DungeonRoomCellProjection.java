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

public final class DungeonRoomCellProjection {

    public static final DungeonCell LOOP_SEPARATOR = new DungeonCell(Integer.MIN_VALUE, Integer.MIN_VALUE, 0);
    private static final DungeonRoomCellPartitionAdapter PARTITION_ADAPTER =
            new DungeonRoomCellPartitionAdapter();

    public Map<Long, List<DungeonCell>> cellsByRoom(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        List<DungeonRoom> safeRooms = rooms == null ? List.of() : rooms;
        return PARTITION_ADAPTER.cellsByRoom(cluster, safeRooms, cellsByLevel(cluster, safeRooms));
    }

    public Map<Integer, List<DungeonCell>> cellsByLevel(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Integer level : levels(cluster, rooms)) {
            result.put(level, DungeonCellOrdering.sortedCells(clusterCells(cluster, rooms, level)));
        }
        return Map.copyOf(result);
    }

    public Set<DungeonCell> clusterCells(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            int level
    ) {
        List<DungeonCell> vertices = cluster.relativeVerticesByLevel().getOrDefault(level, List.of());
        if (!vertices.isEmpty()) {
            return cellsFromRelativeVertices(cluster.center(), level, vertices);
        }
        Set<DungeonCell> anchors = new LinkedHashSet<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            DungeonCell anchor = room.floorAnchors().get(level);
            if (anchor != null) {
                anchors.add(anchor);
            }
        }
        if (anchors.isEmpty()) {
            anchors.add(new DungeonCell(cluster.center().q(), cluster.center().r(), level));
        }
        return anchors;
    }

    public List<DungeonCell> relativeCellLoops(DungeonCell center, List<DungeonCell> cells) {
        if (center == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return flattenedDungeonCells(CellLoopRasterizer.relativeCellLoops(center.geometry(), coreCells(cells)));
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

    private static Set<DungeonCell> cellsFromRelativeVertices(
            DungeonCell center,
            int level,
            List<DungeonCell> relativeVertices
    ) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (Cell cell : CellLoopRasterizer.cellsFromRelativeVertices(
                center.geometry(),
                level,
                coreLoops(relativeVertices))) {
            result.add(DungeonCell.fromGeometry(cell));
        }
        return Set.copyOf(result);
    }

    private static List<CellLoop> coreLoops(List<DungeonCell> cells) {
        List<CellLoop> loops = new ArrayList<>();
        List<Cell> currentLoop = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (LOOP_SEPARATOR.equals(cell)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(new CellLoop(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            if (cell != null) {
                currentLoop.add(cell.geometry());
            }
        }
        if (!currentLoop.isEmpty()) {
            loops.add(new CellLoop(currentLoop));
        }
        return List.copyOf(loops);
    }

    private static List<Cell> coreCells(List<DungeonCell> cells) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCell> flattenedDungeonCells(List<CellLoop> loops) {
        List<DungeonCell> result = new ArrayList<>();
        List<CellLoop> safeLoops = loops == null ? List.of() : loops;
        boolean separateLoops = safeLoops.size() > 1;
        for (CellLoop loop : safeLoops) {
            for (Cell cell : loop.vertices()) {
                result.add(DungeonCell.fromGeometry(cell));
            }
            if (separateLoops) {
                result.add(LOOP_SEPARATOR);
            }
        }
        return List.copyOf(result);
    }

}
