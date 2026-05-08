package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonRoomCellProjector {

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
            result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).add(room.primaryAnchor());
        }
        return normalizeCellsByRoom(result);
    }

    public Map<Integer, List<DungeonCell>> cellsByLevel(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Integer level : levels(cluster, rooms)) {
            result.put(level, sortedCells(clusterCells(cluster, rooms, level)));
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

    public List<Set<DungeonCell>> connectedComponents(Set<DungeonCell> cells) {
        List<Set<DungeonCell>> components = new ArrayList<>(TRAVERSAL_SUPPORT.connectedComponents(cells));
        components.sort(Comparator
                .comparingInt((Set<DungeonCell> component) -> component.stream()
                        .mapToInt(DungeonCell::level)
                        .min()
                        .orElse(0))
                .thenComparingInt(component -> component.stream().mapToInt(DungeonCell::r).min().orElse(0))
                .thenComparingInt(component -> component.stream().mapToInt(DungeonCell::q).min().orElse(0)));
        return List.copyOf(components);
    }

    public static Map<Integer, DungeonCell> anchorsByLevel(Map<Integer, List<DungeonCell>> cellsByLevel) {
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                result.put(entry.getKey(), sortedCells(entry.getValue()).getFirst());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> normalizeCellsByRoom(Map<Long, List<DungeonCell>> source) {
        Map<Long, List<DungeonCell>> normalized = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : source.entrySet()) {
            normalized.put(entry.getKey(), sortedCells(entry.getValue()));
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

    static Set<DungeonCell> reachableCells(
            DungeonCell anchor,
            Set<DungeonCell> traversableCells,
            List<DungeonClusterBoundary> barriers,
            DungeonCell center
    ) {
        return TRAVERSAL_SUPPORT.reachableCells(anchor, traversableCells, barriers, center);
    }

    public static List<DungeonCell> sortedCells(Iterable<DungeonCell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result.stream()
                .distinct()
                .sorted(Comparator
                        .comparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .toList();
    }
}
