package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;

final class DungeonClusterCornerMoveLogic {

    private static final long NO_ID = 0L;
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();
    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();

    DungeonMap moveCorner(DungeonMap dungeonMap, DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        if (dungeonMap == null || handle == null || deltaLevel != 0) {
            return dungeonMap;
        }
        long clusterId = handle.clusterId() > 0L
                ? handle.clusterId()
                : dungeonMap.topologyIndex().clusterIdFor(handle.topologyRef()).orElse(0L);
        if (clusterId <= NO_ID) {
            return dungeonMap;
        }
        DungeonMap moved = dungeonMap;
        DungeonCell corner = handle.cell();
        if (deltaQ != 0) {
            List<DungeonEdge> verticalEdges = sideEdges(moved, clusterId, corner, true);
            moved = STRETCH_EDIT_SERVICE.moveBoundaryStretch(moved, clusterId, verticalEdges, deltaQ, 0, 0);
            corner = new DungeonCell(corner.q() + deltaQ, corner.r(), corner.level());
        }
        if (deltaR != 0) {
            List<DungeonEdge> horizontalEdges = sideEdges(moved, clusterId, corner, false);
            moved = STRETCH_EDIT_SERVICE.moveBoundaryStretch(moved, clusterId, horizontalEdges, 0, deltaR, 0);
        }
        return moved;
    }

    private static List<DungeonEdge> sideEdges(
            DungeonMap dungeonMap,
            long clusterId,
            DungeonCell corner,
            boolean vertical
    ) {
        DungeonRoomTopologyClusterWork target = targetCluster(dungeonMap, clusterId);
        if (target == null || corner == null) {
            return List.of();
        }
        List<DungeonCell> cells = target.cellsAt(corner.level());
        if (cells.isEmpty()) {
            return List.of();
        }
        int minQ = minQ(cells);
        int maxQ = maxQ(cells);
        int minR = minR(cells);
        int maxR = maxR(cells);
        return vertical
                ? verticalEdges(minQ, maxQ, minR, maxR, corner.q(), corner.level())
                : horizontalEdges(minQ, maxQ, minR, maxR, corner.r(), corner.level());
    }

    private static DungeonRoomTopologyClusterWork targetCluster(DungeonMap dungeonMap, long clusterId) {
        for (DungeonRoomTopologyClusterWork work : WORK_SERVICE.workClusters(dungeonMap)) {
            if (work.cluster().clusterId() == clusterId) {
                return work;
            }
        }
        return null;
    }

    private static List<DungeonEdge> verticalEdges(
            int minQ,
            int maxQ,
            int minR,
            int maxR,
            int fixedQ,
            int level
    ) {
        if (fixedQ != minQ && fixedQ != maxQ + 1) {
            return List.of();
        }
        List<DungeonEdge> result = new ArrayList<>();
        for (int r = minR; r <= maxR; r++) {
            result.add(new DungeonEdge(new DungeonCell(fixedQ, r, level), new DungeonCell(fixedQ, r + 1, level)));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEdge> horizontalEdges(
            int minQ,
            int maxQ,
            int minR,
            int maxR,
            int fixedR,
            int level
    ) {
        if (fixedR != minR && fixedR != maxR + 1) {
            return List.of();
        }
        List<DungeonEdge> result = new ArrayList<>();
        for (int q = minQ; q <= maxQ; q++) {
            result.add(new DungeonEdge(new DungeonCell(q, fixedR, level), new DungeonCell(q + 1, fixedR, level)));
        }
        return List.copyOf(result);
    }

    private static int minQ(List<DungeonCell> cells) {
        int minQ = cells.getFirst().q();
        for (DungeonCell cell : cells) {
            minQ = Math.min(minQ, cell.q());
        }
        return minQ;
    }

    private static int maxQ(List<DungeonCell> cells) {
        int maxQ = cells.getFirst().q();
        for (DungeonCell cell : cells) {
            maxQ = Math.max(maxQ, cell.q());
        }
        return maxQ;
    }

    private static int minR(List<DungeonCell> cells) {
        int minR = cells.getFirst().r();
        for (DungeonCell cell : cells) {
            minR = Math.min(minR, cell.r());
        }
        return minR;
    }

    private static int maxR(List<DungeonCell> cells) {
        int maxR = cells.getFirst().r();
        for (DungeonCell cell : cells) {
            maxR = Math.max(maxR, cell.r());
        }
        return maxR;
    }
}
