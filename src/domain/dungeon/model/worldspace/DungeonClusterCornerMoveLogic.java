package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomTopologyWorkCatalog;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

final class DungeonClusterCornerMoveLogic {

    private static final long NO_ID = 0L;
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();

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
                : dungeonMap.topologyIndex().clusterIdOrZero(handle.topologyRef());
        if (clusterId <= NO_ID) {
            return dungeonMap;
        }
        DungeonMap moved = dungeonMap;
        Cell corner = handle.cell();
        if (deltaQ != 0) {
            List<Edge> verticalEdges = sideEdges(moved, clusterId, corner, true);
            moved = STRETCH_EDIT_SERVICE.moveBoundaryStretch(moved, clusterId, verticalEdges, deltaQ, 0, 0);
            corner = new Cell(corner.q() + deltaQ, corner.r(), corner.level());
        }
        if (deltaR != 0) {
            List<Edge> horizontalEdges = sideEdges(moved, clusterId, corner, false);
            moved = STRETCH_EDIT_SERVICE.moveBoundaryStretch(moved, clusterId, horizontalEdges, 0, deltaR, 0);
        }
        return moved;
    }

    private static List<Edge> sideEdges(
            DungeonMap dungeonMap,
            long clusterId,
            Cell corner,
            boolean vertical
    ) {
        if (corner == null) {
            return List.of();
        }
        List<Edge> result = new ArrayList<>();
        WORK_CATALOG.workCluster(dungeonMap.topology(), dungeonMap.rooms(), clusterId)
                .map(target -> target.cluster().toCore(target.cellsByLevel()).boundingSideEdges(corner, vertical))
                .ifPresent(edges -> appendEdges(result, edges));
        return List.copyOf(result);
    }

    private static void appendEdges(List<Edge> result, List<Edge> edges) {
        for (Edge edge : edges) {
            result.add(new Edge(
                    edge.from(),
                    edge.to()));
        }
    }
}
