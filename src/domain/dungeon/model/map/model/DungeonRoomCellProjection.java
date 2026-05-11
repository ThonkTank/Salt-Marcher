package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonRoomCluster;
import src.domain.dungeon.model.map.model.DungeonCell;

import java.util.ArrayList;
import java.util.Comparator;
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
        components.sort(new ComponentComparator());
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

    public static List<DungeonCell> sortedCells(Iterable<DungeonCell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        List<DungeonCell> unique = new ArrayList<>();
        for (DungeonCell cell : result) {
            if (!unique.contains(cell)) {
                unique.add(cell);
            }
        }
        unique.sort(new CellComparator());
        return List.copyOf(unique);
    }

    private static int minimumLevel(Set<DungeonCell> component) {
        int result = 0;
        boolean found = false;
        for (DungeonCell cell : component == null ? Set.<DungeonCell>of() : component) {
            if (cell != null && (!found || cell.level() < result)) {
                result = cell.level();
                found = true;
            }
        }
        return result;
    }

    private static int minimumRow(Set<DungeonCell> component) {
        int result = 0;
        boolean found = false;
        for (DungeonCell cell : component == null ? Set.<DungeonCell>of() : component) {
            if (cell != null && (!found || cell.r() < result)) {
                result = cell.r();
                found = true;
            }
        }
        return result;
    }

    private static int minimumColumn(Set<DungeonCell> component) {
        int result = 0;
        boolean found = false;
        for (DungeonCell cell : component == null ? Set.<DungeonCell>of() : component) {
            if (cell != null && (!found || cell.q() < result)) {
                result = cell.q();
                found = true;
            }
        }
        return result;
    }

    private static final class ComponentComparator implements Comparator<Set<DungeonCell>> {
        @Override
        public int compare(Set<DungeonCell> left, Set<DungeonCell> right) {
            int levelComparison = Integer.compare(minimumLevel(left), minimumLevel(right));
            if (levelComparison != 0) {
                return levelComparison;
            }
            int rowComparison = Integer.compare(minimumRow(left), minimumRow(right));
            if (rowComparison != 0) {
                return rowComparison;
            }
            return Integer.compare(minimumColumn(left), minimumColumn(right));
        }
    }

    private static final class CellComparator implements Comparator<DungeonCell> {
        @Override
        public int compare(DungeonCell left, DungeonCell right) {
            int levelComparison = Integer.compare(left.level(), right.level());
            if (levelComparison != 0) {
                return levelComparison;
            }
            int rowComparison = Integer.compare(left.r(), right.r());
            if (rowComparison != 0) {
                return rowComparison;
            }
            return Integer.compare(left.q(), right.q());
        }
    }
}
