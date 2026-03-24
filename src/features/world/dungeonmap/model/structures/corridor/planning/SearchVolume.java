package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class SearchVolume {

    private static final int HORIZONTAL_PADDING = 6;
    private static final int VERTICAL_PADDING = 1;

    private final int minX;
    private final int minY;
    private final int minZ;
    private final int maxX;
    private final int maxY;
    private final int maxZ;
    private final boolean[][][] blocked;

    private SearchVolume(int minX, int minY, int minZ, int maxX, int maxY, int maxZ, boolean[][][] blocked) {
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
        this.blocked = blocked;
    }

    static SearchVolume enclosing(
            Set<CubePoint> obstacles,
            List<Room> targetRooms,
            Map<Long, Integer> roomLevels,
            List<Point2i> waypointCells
    ) {
        Set<CubePoint> boundsPoints = new LinkedHashSet<>();
        if (obstacles != null) {
            boundsPoints.addAll(obstacles);
        }
        for (Room room : targetRooms == null ? List.<Room>of() : targetRooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            int levelZ = roomLevels == null ? 0 : roomLevels.getOrDefault(room.roomId(), 0);
            for (Point2i cell : room.cells()) {
                boundsPoints.add(CubePoint.at(cell, levelZ));
            }
        }
        Set<Integer> levels = new LinkedHashSet<>();
        if (!boundsPoints.isEmpty()) {
            boundsPoints.stream().map(CubePoint::z).forEach(levels::add);
        }
        if (levels.isEmpty()) {
            levels.add(0);
        }
        for (Point2i waypoint : waypointCells == null ? List.<Point2i>of() : waypointCells) {
            if (waypoint == null) {
                continue;
            }
            for (int level : levels) {
                boundsPoints.add(CubePoint.at(waypoint, level));
            }
        }
        if (boundsPoints.isEmpty()) {
            boundsPoints.add(new CubePoint(0, 0, 0));
        }
        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int minZ = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int maxY = Integer.MIN_VALUE;
        int maxZ = Integer.MIN_VALUE;
        for (CubePoint point : boundsPoints) {
            minX = Math.min(minX, point.x());
            minY = Math.min(minY, point.y());
            minZ = Math.min(minZ, point.z());
            maxX = Math.max(maxX, point.x());
            maxY = Math.max(maxY, point.y());
            maxZ = Math.max(maxZ, point.z());
        }
        boolean supportsVerticalTravel = minZ != maxZ;
        minX -= HORIZONTAL_PADDING;
        minY -= HORIZONTAL_PADDING;
        maxX += HORIZONTAL_PADDING;
        maxY += HORIZONTAL_PADDING;
        if (supportsVerticalTravel) {
            minZ -= VERTICAL_PADDING;
            maxZ += VERTICAL_PADDING;
        }
        boolean[][][] blocked = new boolean[maxX - minX + 1][maxY - minY + 1][maxZ - minZ + 1];
        for (CubePoint obstacle : obstacles == null ? Set.<CubePoint>of() : obstacles) {
            int x = obstacle.x() - minX;
            int y = obstacle.y() - minY;
            int z = obstacle.z() - minZ;
            if (x >= 0 && x < blocked.length
                    && y >= 0 && y < blocked[x].length
                    && z >= 0 && z < blocked[x][y].length) {
                blocked[x][y][z] = true;
            }
        }
        return new SearchVolume(minX, minY, minZ, maxX, maxY, maxZ, blocked);
    }

    boolean isPassable(CubePoint point) {
        return isInBounds(point) && !blocked[point.x() - minX][point.y() - minY][point.z() - minZ];
    }

    boolean isInBounds(CubePoint point) {
        return point != null
                && point.x() >= minX
                && point.x() <= maxX
                && point.y() >= minY
                && point.y() <= maxY
                && point.z() >= minZ
                && point.z() <= maxZ;
    }

    int minZ() {
        return minZ;
    }

    int maxZ() {
        return maxZ;
    }
}
