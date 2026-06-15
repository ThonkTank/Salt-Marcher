package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;

final class RoomCellOwnerSelection {

    private RoomCellOwnerSelection() {
    }

    static List<Room> roomsWithAnchorsIn(List<Room> rooms, int level, Set<Cell> component) {
        List<Room> result = new ArrayList<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null && component.contains(room.floorAnchors().get(level))) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    static Room nearestRoom(Cell cell, List<Room> rooms, int level) {
        Room result = null;
        int bestDistance = Integer.MAX_VALUE;
        for (Room room : rooms) {
            Cell anchor = room.floorAnchors().get(level);
            int distance = gridDistance(cell, anchor);
            if (result == null || distance < bestDistance
                    || distance == bestDistance && room.roomId() < result.roomId()) {
                result = room;
                bestDistance = distance;
            }
        }
        return result;
    }

    private static int gridDistance(Cell left, Cell right) {
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }
}
