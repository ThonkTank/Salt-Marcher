package src.domain.dungeon.model.core.structure;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterMovement;
import src.domain.dungeon.model.core.structure.room.RoomTopologyAuthoring;

final class DungeonMapRoomAuthoring {
    private final RoomTopologyAuthoring roomAuthoring = new RoomTopologyAuthoring();
    private final RoomClusterMovement roomClusterMovement = new RoomClusterMovement();

    DungeonMap moveCluster(DungeonMap dungeonMap, long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        return roomClusterMovement.moveCluster(dungeonMap, clusterId, deltaQ, deltaR, deltaLevel);
    }

    DungeonMap moveClusterCorner(
            DungeonMap dungeonMap,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return roomAuthoring.moveClusterCorner(dungeonMap, clusterId, corner, deltaQ, deltaR, deltaLevel);
    }

    DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return roomAuthoring.moveBoundaryStretch(dungeonMap, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
    }

    DungeonMap paintRoomRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        return roomAuthoring.paintRectangle(dungeonMap, start, end);
    }

    DungeonMap deleteRoomRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        return roomAuthoring.deleteRectangle(dungeonMap, start, end);
    }

    DungeonMap editClusterBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        return roomAuthoring.editBoundaries(dungeonMap, clusterId, edges, kind, deleteBoundary);
    }
}
