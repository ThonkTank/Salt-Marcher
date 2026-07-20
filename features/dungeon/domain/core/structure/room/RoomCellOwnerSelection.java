package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

final class RoomCellOwnerSelection {

    private RoomCellOwnerSelection() {
    }

    static List<RoomRegion> roomsWithAnchorsIn(List<RoomRegion> rooms, int level, Set<Cell> component) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null && component.contains(room.floorAnchors().get(level))) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    static List<RoomRegion> roomsWithAnchorAt(List<RoomRegion> rooms, int level) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null && room.floorAnchors().containsKey(level)) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    static RoomRegion nearestRoom(Cell cell, List<RoomRegion> rooms, int level) {
        RoomRegion result = null;
        int bestDistance = Integer.MAX_VALUE;
        for (RoomRegion room : rooms) {
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
