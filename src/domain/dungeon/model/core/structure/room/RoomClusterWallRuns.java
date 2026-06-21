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

final class RoomClusterWallRuns {
    private static final int MINIMUM_WALL_RUN_LENGTH = 2;

    private RoomClusterWallRuns() {
    }

    static List<RoomClusterWallRun> authoredWallRuns(
            BoundaryMap boundaryMap,
            Map<EdgeKey, BoundaryRow> rowsByKey,
            int level
    ) {
        List<RoomClusterWallRun> result = new ArrayList<>();
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
            List<RoomClusterWallRun> result,
            List<EdgeKey> edgeKeys,
            Map<EdgeKey, BoundaryRow> rowsByKey
    ) {
        List<EdgeKey> currentKeys = new ArrayList<>();
        Direction currentDirection = null;
        List<EdgeKey> safeEdgeKeys = edgeKeys == null ? List.of() : edgeKeys;
        for (int index = 0; index < safeEdgeKeys.size(); index++) {
            EdgeKey edgeKey = safeEdgeKeys.get(index);
            Direction direction = directionForEdge(safeEdgeKeys, index, rowsByKey);
            if (currentDirection != null && direction != currentDirection) {
                addDirectionalRun(result, currentKeys, currentDirection, rowsByKey);
                currentKeys = new ArrayList<>();
            }
            currentKeys.add(edgeKey);
            currentDirection = direction;
        }
        addDirectionalRun(result, currentKeys, currentDirection, rowsByKey);
    }

    private static Direction directionForEdge(List<EdgeKey> edgeKeys, int index, Map<EdgeKey, BoundaryRow> rowsByKey) {
        EdgeKey edgeKey = edgeKeys.get(index);
        BoundaryRow row = rowsByKey.get(edgeKey);
        if (row != null && row.kind() != BoundaryKind.DOOR && row.direction() != null) {
            return row.direction();
        }
        for (int offset = 1; offset < edgeKeys.size(); offset++) {
            int before = index - offset;
            if (before >= 0) {
                Direction direction = wallDirection(edgeKeys.get(before), rowsByKey);
                if (direction != null) {
                    return direction;
                }
            }
            int after = index + offset;
            if (after < edgeKeys.size()) {
                Direction direction = wallDirection(edgeKeys.get(after), rowsByKey);
                if (direction != null) {
                    return direction;
                }
            }
        }
        return Direction.NORTH;
    }

    private static Direction wallDirection(EdgeKey edgeKey, Map<EdgeKey, BoundaryRow> rowsByKey) {
        BoundaryRow row = rowsByKey.get(edgeKey);
        if (row != null && row.kind() != BoundaryKind.DOOR && row.direction() != null) {
            return row.direction();
        }
        return null;
    }

    private static void addDirectionalRun(
            List<RoomClusterWallRun> result,
            List<EdgeKey> edgeKeys,
            Direction direction,
            Map<EdgeKey, BoundaryRow> rowsByKey
    ) {
        if (edgeKeys == null || edgeKeys.size() < MINIMUM_WALL_RUN_LENGTH) {
            return;
        }
        addRun(result, direction, edgeKeys, rowsByKey);
    }

    private static void addRun(
            List<RoomClusterWallRun> result,
            Direction direction,
            List<EdgeKey> edgeKeys,
            Map<EdgeKey, BoundaryRow> rowsByKey
    ) {
        EdgeKey first = edgeKeys.getFirst();
        EdgeKey last = edgeKeys.getLast();
        boolean horizontal = first.lower().r() == first.upper().r();
        int fixed = horizontal ? first.lower().r() : first.lower().q();
        int start = horizontal
                ? Math.min(first.lower().q(), first.upper().q())
                : Math.min(first.lower().r(), first.upper().r());
        int end = horizontal
                ? Math.max(last.lower().q(), last.upper().q())
                : Math.max(last.lower().r(), last.upper().r());
        if (end - start < MINIMUM_WALL_RUN_LENGTH) {
            return;
        }
        double variableMidpoint = (start + end) / 2.0;
        int anchorCoordinate = (int) Math.floor(variableMidpoint);
        EdgeKey sourceEdge = sourceEdge(edgeKeys, rowsByKey);
        Cell sourceFrom = sourceEdge.lower();
        Cell sourceTo = sourceEdge.upper();
        Cell anchorCell = horizontal
                ? new Cell(anchorCoordinate, fixed, sourceFrom.level())
                : new Cell(fixed, anchorCoordinate, sourceFrom.level());
        result.add(new RoomClusterWallRun(
                anchorCell,
                horizontal ? variableMidpoint : fixed,
                horizontal ? fixed : variableMidpoint,
                direction,
                new Edge(sourceFrom, sourceTo)));
    }

    private static EdgeKey sourceEdge(List<EdgeKey> edgeKeys, Map<EdgeKey, BoundaryRow> rowsByKey) {
        int midpointIndex = edgeKeys.size() / 2;
        for (int offset = 0; offset < edgeKeys.size(); offset++) {
            int before = midpointIndex - offset;
            if (before >= 0 && !doorRow(edgeKeys.get(before), rowsByKey)) {
                return edgeKeys.get(before);
            }
            int after = midpointIndex + offset;
            if (after < edgeKeys.size() && !doorRow(edgeKeys.get(after), rowsByKey)) {
                return edgeKeys.get(after);
            }
        }
        return edgeKeys.get(midpointIndex);
    }

    private static boolean doorRow(EdgeKey edgeKey, Map<EdgeKey, BoundaryRow> rowsByKey) {
        BoundaryRow row = rowsByKey.get(edgeKey);
        return row != null && row.kind() == BoundaryKind.DOOR;
    }
}
