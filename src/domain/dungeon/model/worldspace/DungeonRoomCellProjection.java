package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonRoomCellProjection {

    public static final DungeonCell LOOP_SEPARATOR = new DungeonCell(Integer.MIN_VALUE, Integer.MIN_VALUE, 0);
    private static final DungeonCellTraversalSupport TRAVERSAL_SUPPORT = new DungeonCellTraversalSupport();
    private static final DungeonRoomCellRasterizer RASTERIZER = new DungeonRoomCellRasterizer();

    public Map<Long, List<DungeonCell>> cellsByRoom(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        List<DungeonRoom> safeRooms = rooms == null ? List.of() : rooms;
        for (Integer level : levels(cluster, safeRooms)) {
            DungeonRoomCellAssignmentSupport.assignLevelCells(result, this, cluster, safeRooms, level);
        }
        for (DungeonRoom room : safeRooms) {
            List<DungeonCell> roomCells = result.get(room.roomId());
            if (roomCells == null) {
                roomCells = new ArrayList<>();
                result.put(room.roomId(), roomCells);
            }
            roomCells.add(room.primaryAnchor());
        }
        return normalizeCellsByRoom(result);
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
        return RASTERIZER.relativeCellLoops(center, cells, LOOP_SEPARATOR);
    }

    private static Map<Long, List<DungeonCell>> normalizeCellsByRoom(Map<Long, List<DungeonCell>> source) {
        Map<Long, List<DungeonCell>> normalized = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : source.entrySet()) {
            normalized.put(entry.getKey(), DungeonCellOrdering.sortedCells(entry.getValue()));
        }
        return Map.copyOf(normalized);
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
        return RASTERIZER.cellsFromRelativeVertices(center, level, relativeVertices, LOOP_SEPARATOR);
    }

}
