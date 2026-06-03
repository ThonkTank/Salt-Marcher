package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Edge;

final class DungeonClusterCornerMoveLogic {

    private static final long NO_ID = 0L;
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();
    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();

    DungeonMap moveCorner(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
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
        List<DungeonEdge> result = new ArrayList<>();
        for (Edge edge : target.cluster().toCore(target.cellsByLevel()).boundingSideEdges(corner.geometry(), vertical)) {
            result.add(new DungeonEdge(
                    DungeonCell.fromGeometry(edge.from()),
                    DungeonCell.fromGeometry(edge.to())));
        }
        return List.copyOf(result);
    }

    private static DungeonRoomTopologyClusterWork targetCluster(DungeonMap dungeonMap, long clusterId) {
        return WORK_SERVICE.workCluster(dungeonMap, clusterId);
    }
}
