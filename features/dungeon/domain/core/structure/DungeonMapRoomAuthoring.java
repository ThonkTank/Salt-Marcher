package features.dungeon.domain.core.structure;

import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterMovement;
import features.dungeon.domain.core.structure.room.RoomTopologyAuthoring;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;

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
            int deltaLevel,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        return roomAuthoring.moveClusterCorner(
                dungeonMap, clusterId, corner, deltaQ, deltaR, deltaLevel, ids);
    }

    DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        return roomAuthoring.moveBoundaryStretch(
                dungeonMap, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel, ids);
    }

    DungeonMap paintRoomRectangle(
            DungeonMap dungeonMap,
            Cell start,
            Cell end,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        return roomAuthoring.paintRectangle(dungeonMap, start, end, ids);
    }

    DungeonMap deleteRoomRectangle(
            DungeonMap dungeonMap,
            Cell start,
            Cell end,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        return roomAuthoring.deleteRectangle(dungeonMap, start, end, ids);
    }

    DungeonMap editClusterBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        return roomAuthoring.editBoundaries(
                dungeonMap, clusterId, edges, kind, deleteBoundary, ids);
    }
}
