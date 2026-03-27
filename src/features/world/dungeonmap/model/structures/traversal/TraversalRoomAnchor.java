package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashSet;
import java.util.Set;

public record TraversalRoomAnchor(
        Long roomId,
        Long clusterId,
        Point2i anchorCell,
        Set<CubePoint> occupiedCells,
        Set<Integer> levels
) {
    public TraversalRoomAnchor {
        occupiedCells = normalizeOccupiedCells(occupiedCells);
        levels = normalizeLevels(levels, occupiedCells);
        anchorCell = anchorCell == null ? deriveAnchorCell(occupiedCells) : anchorCell;
    }

    public static TraversalRoomAnchor from(Room room) {
        if (room == null) {
            return null;
        }
        Point2i anchorCell = room.floor() == null ? null : room.floor().shape().centerCell();
        return new TraversalRoomAnchor(
                room.roomId(),
                room.clusterId(),
                anchorCell,
                room.cubePoints(),
                room.levels());
    }

    public int primaryLevel() {
        return levels.stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    private static Set<CubePoint> normalizeOccupiedCells(Set<CubePoint> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint occupiedCell : occupiedCells) {
            if (occupiedCell != null) {
                result.add(occupiedCell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<Integer> normalizeLevels(Set<Integer> levels, Set<CubePoint> occupiedCells) {
        if (levels != null && !levels.isEmpty()) {
            return Set.copyOf(levels);
        }
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Integer> derivedLevels = new LinkedHashSet<>();
        for (CubePoint occupiedCell : occupiedCells) {
            if (occupiedCell != null) {
                derivedLevels.add(occupiedCell.z());
            }
        }
        return derivedLevels.isEmpty() ? Set.of() : Set.copyOf(derivedLevels);
    }

    private static Point2i deriveAnchorCell(Set<CubePoint> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return new Point2i(0, 0);
        }
        CubePoint anchorPoint = occupiedCells.stream()
                .filter(java.util.Objects::nonNull)
                .min(CubePoint.POINT_ORDER)
                .orElse(null);
        return anchorPoint == null ? new Point2i(0, 0) : anchorPoint.projectedCell();
    }
}
