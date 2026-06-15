package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.component.boundary.BoundaryMap;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

final class RoomClusterWallRuns {
    private static final int MINIMUM_WALL_RUN_LENGTH = 2;

    private RoomClusterWallRuns() {
    }

    static List<WallRun> authoredWallRuns(
            BoundaryMap boundaryMap,
            Map<EdgeKey, BoundaryRow> rowsByKey,
            int level
    ) {
        List<WallRun> result = new ArrayList<>();
        for (src.domain.dungeon.model.core.component.boundary.WallRun wallRun
                : componentWallRuns(boundaryMap, level)) {
            appendDirectionalRuns(result, wallRun.edgeKeys(), rowsByKey);
        }
        return List.copyOf(result);
    }

    private static List<src.domain.dungeon.model.core.component.boundary.WallRun> componentWallRuns(
            BoundaryMap boundaryMap,
            int level
    ) {
        return boundaryMap == null
                ? List.of()
                : boundaryMap.wallRunsAt(level);
    }

    private static void appendDirectionalRuns(
            List<WallRun> result,
            List<EdgeKey> edgeKeys,
            Map<EdgeKey, BoundaryRow> rowsByKey
    ) {
        List<EdgeKey> currentKeys = new ArrayList<>();
        Direction currentDirection = null;
        for (EdgeKey edgeKey : edgeKeys == null ? List.<EdgeKey>of() : edgeKeys) {
            Direction direction = directionForEdge(edgeKey, rowsByKey);
            if (currentDirection != null && direction != currentDirection) {
                addDirectionalRun(result, currentKeys, currentDirection);
                currentKeys = new ArrayList<>();
            }
            currentKeys.add(edgeKey);
            currentDirection = direction;
        }
        addDirectionalRun(result, currentKeys, currentDirection);
    }

    private static Direction directionForEdge(EdgeKey edgeKey, Map<EdgeKey, BoundaryRow> rowsByKey) {
        BoundaryRow row = rowsByKey.get(edgeKey);
        if (row != null && row.kind() == BoundaryKind.WALL && row.direction() != null) {
            return row.direction();
        }
        return Direction.NORTH;
    }

    private static void addDirectionalRun(List<WallRun> result, List<EdgeKey> edgeKeys, Direction direction) {
        if (edgeKeys == null || edgeKeys.isEmpty()) {
            return;
        }
        EdgeKey first = edgeKeys.getFirst();
        boolean horizontal = first.lower().r() == first.upper().r();
        int fixed = horizontal ? first.lower().r() : first.lower().q();
        int start = Integer.MAX_VALUE;
        int end = Integer.MIN_VALUE;
        for (EdgeKey edgeKey : edgeKeys) {
            int lower = horizontal ? edgeKey.lower().q() : edgeKey.lower().r();
            int upper = horizontal ? edgeKey.upper().q() : edgeKey.upper().r();
            start = Math.min(start, Math.min(lower, upper));
            end = Math.max(end, Math.max(lower, upper));
        }
        addRun(result, direction, horizontal, fixed, first.lower().level(), start, end);
    }

    private static void addRun(
            List<WallRun> result,
            Direction direction,
            boolean horizontal,
            int fixed,
            int level,
            int start,
            int end
    ) {
        if (end - start < MINIMUM_WALL_RUN_LENGTH) {
            return;
        }
        double variableMidpoint = (start + end) / 2.0;
        int anchorCoordinate = (int) Math.floor(variableMidpoint);
        Cell sourceFrom = horizontal
                ? new Cell(anchorCoordinate, fixed, level)
                : new Cell(fixed, anchorCoordinate, level);
        Cell sourceTo = horizontal
                ? new Cell(anchorCoordinate + 1, fixed, level)
                : new Cell(fixed, anchorCoordinate + 1, level);
        result.add(new WallRun(
                horizontal ? new src.domain.dungeon.model.core.geometry.Cell(anchorCoordinate, fixed, level)
                        : new src.domain.dungeon.model.core.geometry.Cell(fixed, anchorCoordinate, level),
                horizontal ? variableMidpoint : fixed,
                horizontal ? fixed : variableMidpoint,
                direction,
                new Edge(sourceFrom, sourceTo)));
    }
}
