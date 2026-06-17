package src.view.slotcontent.main.dungeonmap;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class DungeonMapRoomLabelPlacementContentPartModel {
    private static final double WALL_OFFSET_SCENE = 0.34;
    private static final double EPSILON = 0.000_001;

    RoomLabelPlacement placementFor(List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells) {
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> safeCells = cells == null ? List.of() : cells;
        DungeonMapContentModel.EditorProjectionFacts.CellCenter fallback =
                DungeonMapContentModel.EditorProjectionFacts.centerOfCells(safeCells);
        if (safeCells.isEmpty()) {
            return new RoomLabelPlacement(fallback.q(), fallback.r(), 0.0);
        }
        Set<String> occupied = occupiedCells(safeCells);
        WallRun best = null;
        for (DungeonMapContentModel.DungeonMapRenderState.Cell cell : safeCells) {
            best = better(best, horizontalRunIfStart(cell, occupied, -1, 0, 0, 1), fallback);
            best = better(best, horizontalRunIfStart(cell, occupied, 1, 1, 1, -1), fallback);
            best = better(best, verticalRunIfStart(cell, occupied, -1, 2, 0, 1), fallback);
            best = better(best, verticalRunIfStart(cell, occupied, 1, 3, 1, -1), fallback);
        }
        return best == null ? new RoomLabelPlacement(fallback.q(), fallback.r(), 0.0) : best.toPlacement();
    }

    private static Set<String> occupiedCells(List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells) {
        Set<String> occupied = new LinkedHashSet<>();
        for (DungeonMapContentModel.DungeonMapRenderState.Cell cell : cells) {
            occupied.add(cellKey(cell.q(), cell.r(), cell.z()));
        }
        return occupied;
    }

    private static @Nullable WallRun horizontalRunIfStart(
            DungeonMapContentModel.DungeonMapRenderState.Cell cell,
            Set<String> occupied,
            int neighborDeltaR,
            int priority,
            int lineOffsetR,
            int inwardDirection
    ) {
        if (occupied(occupied, cell.q(), cell.r() + neighborDeltaR, cell.z())
                || occupied(occupied, cell.q() - 1, cell.r(), cell.z())
                || !exposed(occupied, cell.q(), cell.r(), cell.z(), 0, neighborDeltaR)) {
            return null;
        }
        int endQ = cell.q();
        while (occupied(occupied, endQ + 1, cell.r(), cell.z())
                && exposed(occupied, endQ + 1, cell.r(), cell.z(), 0, neighborDeltaR)) {
            endQ++;
        }
        double centerQ = (cell.q() + endQ + 1.0) / 2.0;
        double centerR = cell.r() + lineOffsetR + inwardDirection * WALL_OFFSET_SCENE;
        return new WallRun(endQ - cell.q() + 1, centerQ, centerR, 0.0, priority, Double.POSITIVE_INFINITY);
    }

    private static @Nullable WallRun verticalRunIfStart(
            DungeonMapContentModel.DungeonMapRenderState.Cell cell,
            Set<String> occupied,
            int neighborDeltaQ,
            int priority,
            int lineOffsetQ,
            int inwardDirection
    ) {
        if (occupied(occupied, cell.q() + neighborDeltaQ, cell.r(), cell.z())
                || occupied(occupied, cell.q(), cell.r() - 1, cell.z())
                || !exposed(occupied, cell.q(), cell.r(), cell.z(), neighborDeltaQ, 0)) {
            return null;
        }
        int endR = cell.r();
        while (occupied(occupied, cell.q(), endR + 1, cell.z())
                && exposed(occupied, cell.q(), endR + 1, cell.z(), neighborDeltaQ, 0)) {
            endR++;
        }
        double centerQ = cell.q() + lineOffsetQ + inwardDirection * WALL_OFFSET_SCENE;
        double centerR = (cell.r() + endR + 1.0) / 2.0;
        return new WallRun(endR - cell.r() + 1, centerQ, centerR, 90.0, priority, Double.POSITIVE_INFINITY);
    }

    private static WallRun better(
            @Nullable WallRun current,
            @Nullable WallRun candidate,
            DungeonMapContentModel.EditorProjectionFacts.CellCenter center
    ) {
        if (candidate == null) {
            return current;
        }
        WallRun qualifiedCandidate = candidate.withDistanceTo(center);
        if (current == null) {
            return qualifiedCandidate;
        }
        if (qualifiedCandidate.length() != current.length()) {
            return qualifiedCandidate.length() > current.length() ? qualifiedCandidate : current;
        }
        if (qualifiedCandidate.distanceToCentroid() < current.distanceToCentroid() - EPSILON) {
            return qualifiedCandidate;
        }
        if (qualifiedCandidate.distanceToCentroid() > current.distanceToCentroid() + EPSILON) {
            return current;
        }
        return qualifiedCandidate.priority() < current.priority() ? qualifiedCandidate : current;
    }

    private static boolean exposed(
            Set<String> occupied,
            int q,
            int r,
            int z,
            int neighborDeltaQ,
            int neighborDeltaR
    ) {
        return !occupied(occupied, q + neighborDeltaQ, r + neighborDeltaR, z);
    }

    private static boolean occupied(Set<String> occupied, int q, int r, int z) {
        return occupied.contains(cellKey(q, r, z));
    }

    private static String cellKey(int q, int r, int z) {
        return q + "," + r + "," + z;
    }

    record RoomLabelPlacement(double centerQ, double centerR, double rotationDegrees) {
    }

    private record WallRun(
            int length,
            double centerQ,
            double centerR,
            double rotationDegrees,
            int priority,
            double distanceToCentroid
    ) {
        private WallRun withDistanceTo(DungeonMapContentModel.EditorProjectionFacts.CellCenter center) {
            double deltaQ = centerQ - center.q();
            double deltaR = centerR - center.r();
            return new WallRun(length, centerQ, centerR, rotationDegrees, priority, Math.hypot(deltaQ, deltaR));
        }

        private RoomLabelPlacement toPlacement() {
            return new RoomLabelPlacement(centerQ, centerR, rotationDegrees);
        }
    }
}
