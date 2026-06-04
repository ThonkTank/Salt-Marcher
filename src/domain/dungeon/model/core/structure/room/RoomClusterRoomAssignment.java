package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

final class RoomClusterRoomAssignment {

    private RoomClusterRoomAssignment() {
    }

    static Map<Long, List<Cell>> cellsByRoom(
            RoomCluster cluster,
            List<Room> rooms,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel
    ) {
        List<Room> safeRooms = rooms == null ? List.of() : rooms;
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Integer level : levels(cluster, safeRooms, barriersByLevel)) {
            assignLevelCells(
                    result,
                    cluster,
                    safeRooms,
                    level,
                    RoomClusterBoundaryTraversal.barriersAt(barriersByLevel, level));
        }
        for (Room room : safeRooms) {
            if (room != null) {
                roomCells(result, room.roomId()).add(primaryAnchor(room));
            }
        }
        return normalizeCellsByRoom(result);
    }

    private static void assignLevelCells(
            Map<Long, List<Cell>> result,
            RoomCluster cluster,
            List<Room> rooms,
            int level,
            Set<RoomClusterBoundaryTraversal.EdgeKey> barriers
    ) {
        Set<Cell> clusterCells = clusterCells(cluster, rooms, level);
        Set<Cell> unclaimedCells = new LinkedHashSet<>(clusterCells);
        for (Room room : rooms) {
            claimRoomCells(result, room, level, clusterCells, unclaimedCells, barriers);
        }
    }

    private static void claimRoomCells(
            Map<Long, List<Cell>> result,
            Room room,
            int level,
            Set<Cell> clusterCells,
            Set<Cell> unclaimedCells,
            Set<RoomClusterBoundaryTraversal.EdgeKey> barriers
    ) {
        if (room == null) {
            return;
        }
        Cell anchor = room.floorAnchors().get(level);
        if (anchor == null) {
            return;
        }
        if (!clusterCells.contains(anchor)) {
            clusterCells.add(anchor);
            unclaimedCells.add(anchor);
        } else if (!unclaimedCells.contains(anchor)) {
            roomCells(result, room.roomId()).add(anchor);
            return;
        }
        Set<Cell> reachable = RoomClusterBoundaryTraversal.reachableCells(anchor, unclaimedCells, barriers);
        if (reachable.isEmpty()) {
            reachable = Set.of(anchor);
        }
        unclaimedCells.removeAll(reachable);
        roomCells(result, room.roomId()).addAll(reachable);
    }

    private static Set<Cell> clusterCells(RoomCluster cluster, List<Room> rooms, int level) {
        Set<Cell> cells = new LinkedHashSet<>(cluster.cellsAt(level));
        if (!cells.isEmpty()) {
            return cells;
        }
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null && room.floorAnchors().containsKey(level)) {
                cells.add(room.floorAnchors().get(level));
            }
        }
        if (cells.isEmpty()) {
            cells.add(new Cell(cluster.center().q(), cluster.center().r(), level));
        }
        return cells;
    }

    private static Set<Integer> levels(
            RoomCluster cluster,
            List<Room> rooms,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel
    ) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.add(cluster.center().level());
        levels.addAll(cluster.cellsByLevel().keySet());
        if (barriersByLevel != null) {
            levels.addAll(barriersByLevel.keySet());
        }
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null) {
                levels.addAll(room.floorAnchors().keySet());
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

    private static Cell primaryAnchor(Room room) {
        int level = 0;
        Cell result = null;
        for (Map.Entry<Integer, Cell> entry : room.floorAnchors().entrySet()) {
            if (entry.getKey() != null && (result == null || entry.getKey() < level)) {
                level = entry.getKey();
                result = entry.getValue();
            }
        }
        return result == null ? new Cell(0, 0, 0) : result;
    }
}
