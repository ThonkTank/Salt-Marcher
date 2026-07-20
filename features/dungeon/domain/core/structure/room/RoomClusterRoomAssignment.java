package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;

final class RoomClusterRoomAssignment {

    private RoomClusterRoomAssignment() {
    }

    static Map<Long, List<Cell>> cellsByRoom(
            RoomClusterGeometry cluster,
            List<RoomRegion> rooms,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel
    ) {
        List<RoomRegion> safeRooms = rooms == null ? List.of() : rooms;
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Integer level : levels(cluster, safeRooms, barriersByLevel)) {
            assignLevelCells(
                    result,
                    cluster,
                    safeRooms,
                    level,
                    RoomClusterBoundaryTraversal.barriersAt(barriersByLevel, level));
        }
        for (RoomRegion room : safeRooms) {
            if (room != null) {
                roomCells(result, room.roomId()).add(primaryAnchor(room));
            }
        }
        return normalizeCellsByRoom(result);
    }

    private static void assignLevelCells(
            Map<Long, List<Cell>> result,
            RoomClusterGeometry cluster,
            List<RoomRegion> rooms,
            int level,
            Set<EdgeKey> barriers
    ) {
        Set<Cell> clusterCells = clusterCells(cluster, rooms, level);
        for (Set<Cell> component : RoomClusterBoundaryTraversal.connectedComponents(clusterCells, barriers)) {
            List<RoomRegion> componentRooms = RoomCellOwnerSelection.roomsWithAnchorsIn(rooms, level, component);
            assignComponentCells(
                    result,
                    component,
                    componentRooms.isEmpty()
                            ? RoomCellOwnerSelection.roomsWithAnchorAt(rooms, level)
                            : componentRooms,
                    level);
        }
    }

    private static void assignComponentCells(
            Map<Long, List<Cell>> result,
            Set<Cell> component,
            List<RoomRegion> componentRooms,
            int level
    ) {
        if (componentRooms.isEmpty()) {
            return;
        }
        for (Cell cell : RoomClusterCells.sortedCells(component)) {
            RoomRegion owner = RoomCellOwnerSelection.nearestRoom(cell, componentRooms, level);
            roomCells(result, owner.roomId()).add(cell);
        }
    }

    private static Set<Cell> clusterCells(RoomClusterGeometry cluster, List<RoomRegion> rooms, int level) {
        Set<Cell> cells = new LinkedHashSet<>(cluster.cellsAt(level));
        if (!cells.isEmpty()) {
            return cells;
        }
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null && !room.cellsAt(level).isEmpty()) {
                cells.add(room.cellsAt(level).getFirst());
            }
        }
        if (cells.isEmpty()) {
            cells.add(new Cell(cluster.center().q(), cluster.center().r(), level));
        }
        return cells;
    }

    private static Set<Integer> levels(
            RoomClusterGeometry cluster,
            List<RoomRegion> rooms,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel
    ) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.add(cluster.center().level());
        levels.addAll(cluster.cellsByLevel().keySet());
        if (barriersByLevel != null) {
            levels.addAll(barriersByLevel.keySet());
        }
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                levels.addAll(room.cellsByLevel().keySet());
            }
        }
        return Set.copyOf(levels);
    }

    private static Map<Long, List<Cell>> normalizeCellsByRoom(Map<Long, List<Cell>> source) {
        Map<Long, List<Cell>> normalized = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Cell>> entry : source.entrySet()) {
            normalized.put(entry.getKey(), RoomClusterCells.sortedCells(entry.getValue()));
        }
        return Map.copyOf(normalized);
    }

    private static List<Cell> roomCells(Map<Long, List<Cell>> result, long roomId) {
        List<Cell> cells = result.get(roomId);
        if (cells == null) {
            cells = new ArrayList<>();
            result.put(roomId, cells);
        }
        return cells;
    }

    private static Cell primaryAnchor(RoomRegion room) {
        return room.primaryAnchor();
    }
}
