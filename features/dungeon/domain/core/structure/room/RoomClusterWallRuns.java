package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.EdgeKey;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class RoomClusterWallRuns {
    private static final int MINIMUM_WALL_RUN_LENGTH = 2;

    private RoomClusterWallRuns() {
    }

    static List<RoomClusterWallRun> authoredWallRuns(
            BoundaryMap boundaryMap,
            Iterable<Cell> memberCells,
            int level
    ) {
        if (boundaryMap == null) {
            return List.of();
        }
        Set<Cell> cells = copyCells(memberCells);
        List<RoomClusterWallRun> result = new ArrayList<>();
        for (features.dungeon.domain.core.component.boundary.WallRun wallRun : boundaryMap.wallRunsAt(level)) {
            appendDirectionalRuns(result, wallRun.edgeKeys(), boundaryMap, cells);
        }
        return List.copyOf(result);
    }

    private static void appendDirectionalRuns(
            List<RoomClusterWallRun> result,
            List<EdgeKey> edgeKeys,
            BoundaryMap boundaryMap,
            Set<Cell> memberCells
    ) {
        List<EdgeKey> currentKeys = new ArrayList<>();
        Direction currentDirection = null;
        for (int index = 0; index < edgeKeys.size(); index++) {
            EdgeKey edgeKey = edgeKeys.get(index);
            Direction direction = directionForEdge(edgeKeys, index, boundaryMap, memberCells);
            if (direction == null) {
                continue;
            }
            if (currentDirection != null && direction != currentDirection) {
                addRun(result, currentKeys, currentDirection, boundaryMap);
                currentKeys = new ArrayList<>();
            }
            currentKeys.add(edgeKey);
            currentDirection = direction;
        }
        addRun(result, currentKeys, currentDirection, boundaryMap);
    }

    private static Direction directionForEdge(
            List<EdgeKey> edgeKeys,
            int index,
            BoundaryMap boundaryMap,
            Set<Cell> memberCells
    ) {
        Direction own = wallDirection(edgeKeys.get(index), boundaryMap, memberCells);
        if (own != null) {
            return own;
        }
        for (int offset = 1; offset < edgeKeys.size(); offset++) {
            int before = index - offset;
            if (before >= 0) {
                Direction direction = wallDirection(edgeKeys.get(before), boundaryMap, memberCells);
                if (direction != null) {
                    return direction;
                }
            }
            int after = index + offset;
            if (after < edgeKeys.size()) {
                Direction direction = wallDirection(edgeKeys.get(after), boundaryMap, memberCells);
                if (direction != null) {
                    return direction;
                }
            }
        }
        return null;
    }

    private static Direction wallDirection(
            EdgeKey edgeKey,
            BoundaryMap boundaryMap,
            Set<Cell> memberCells
    ) {
        BoundarySegment segment = boundaryMap.segmentsByKey().get(edgeKey);
        if (segment == null || segment.isDoor()) {
            return null;
        }
        List<Cell> inside = segment.edge().touchingCells().stream()
                .filter(memberCells::contains)
                .sorted(CellOrdering::compareCells)
                .toList();
        for (Cell cell : inside) {
            for (Direction direction : Direction.values()) {
                if (EdgeKey.from(direction.edgeOf(cell)).equals(edgeKey)) {
                    return direction;
                }
            }
        }
        return null;
    }

    private static void addRun(
            List<RoomClusterWallRun> result,
            List<EdgeKey> edgeKeys,
            Direction direction,
            BoundaryMap boundaryMap
    ) {
        if (direction == null || edgeKeys.size() < MINIMUM_WALL_RUN_LENGTH) {
            return;
        }
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
        Cell anchorCell = horizontal
                ? new Cell(anchorCoordinate, fixed, first.lower().level())
                : new Cell(fixed, anchorCoordinate, first.lower().level());
        result.add(new RoomClusterWallRun(
                anchorCell,
                horizontal ? variableMidpoint : fixed,
                horizontal ? fixed : variableMidpoint,
                direction,
                RoomClusterWallRunSource.fromDirectionalRun(edgeKeys, boundaryMap)));
    }

    private static Set<Cell> copyCells(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        if (cells != null) {
            cells.forEach(cell -> {
                if (cell != null) {
                    result.add(cell);
                }
            });
        }
        return Set.copyOf(result);
    }
}
