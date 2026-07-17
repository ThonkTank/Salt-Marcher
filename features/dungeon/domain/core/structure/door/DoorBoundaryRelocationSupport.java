package features.dungeon.domain.core.structure.door;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class DoorBoundaryRelocationSupport {

    private static final long NO_ID = 0L;

    private DoorBoundaryRelocationSupport() {
    }

    static @Nullable StandaloneMoveContext standaloneMoveContext(
            DungeonMap sourceMap,
            DungeonTopologyRef topologyRef,
            long clusterId,
            long roomId,
            Edge sourceEdge,
            MovementDelta delta
    ) {
        if (invalidStandaloneRequest(topologyRef, clusterId, sourceEdge, delta)) {
            return null;
        }
        RoomCluster targetCluster = targetCluster(sourceMap, clusterId, roomId);
        if (targetCluster == null) {
            return null;
        }
        return standaloneMoveContextForCluster(targetCluster, topologyRef, sourceEdge, delta);
    }

    private static boolean invalidStandaloneRequest(
            DungeonTopologyRef topologyRef,
            long clusterId,
            Edge sourceEdge,
            MovementDelta delta
    ) {
        return topologyRef == null
                || !topologyRef.present()
                || clusterId <= NO_ID
                || sourceEdge == null
                || (delta.deltaQ() == 0 && delta.deltaR() == 0 && delta.deltaLevel() == 0);
    }

    private static @Nullable StandaloneMoveContext standaloneMoveContextForCluster(
            RoomCluster targetCluster,
            DungeonTopologyRef topologyRef,
            Edge sourceEdge,
            MovementDelta delta
    ) {
        DungeonClusterBoundary oldDoorBoundary = DoorBoundaryRelocationGeometry.boundaryAt(targetCluster, sourceEdge);
        if (oldDoorBoundary == null || !oldDoorBoundary.isDoor()) {
            return null;
        }
        DungeonTopologyRef expectedTopologyRef = oldDoorBoundary.resolvedTopologyRef(targetCluster.center());
        Edge nextDoorEdge = movedEdge(sourceEdge, delta);
        if (!expectedTopologyRef.equals(topologyRef) || sameBoundaryKey(sourceEdge, nextDoorEdge)) {
            return null;
        }
        return new StandaloneMoveContext(targetCluster, oldDoorBoundary, expectedTopologyRef, nextDoorEdge);
    }

    private static @Nullable RoomCluster targetCluster(DungeonMap sourceMap, long clusterId, long roomId) {
        if (roomId > NO_ID) {
            RoomRegion room = sourceMap.rooms().findRoom(roomId).orElse(null);
            if (room == null || room.clusterId() != clusterId) {
                return null;
            }
        }
        for (RoomCluster cluster : sourceMap.topology().roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }

    private static Edge movedEdge(Edge sourceEdge, MovementDelta delta) {
        return new Edge(
                movedCell(sourceEdge.from(), delta),
                movedCell(sourceEdge.to(), delta));
    }

    private static Cell movedCell(Cell sourceCell, MovementDelta delta) {
        return new Cell(
                sourceCell.q() + delta.deltaQ(),
                sourceCell.r() + delta.deltaR(),
                sourceCell.level() + delta.deltaLevel());
    }

    private static boolean sameBoundaryKey(Edge first, Edge second) {
        return DungeonBoundaryKey.from(first).equals(DungeonBoundaryKey.from(second));
    }

    record MovementDelta(int deltaQ, int deltaR, int deltaLevel) {
    }

    record StandaloneMoveContext(
            RoomCluster targetCluster,
            DungeonClusterBoundary oldDoorBoundary,
            DungeonTopologyRef expectedTopologyRef,
            Edge nextDoorEdge
    ) {
    }
}
