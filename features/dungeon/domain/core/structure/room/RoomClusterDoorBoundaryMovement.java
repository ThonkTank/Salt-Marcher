package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

final class RoomClusterDoorBoundaryMovement {

    RoomCluster moved(RoomCluster cluster, RoomClusterDoorBoundaryMove move) {
        if (cluster == null || move == null || move.oldDoorBoundary() == null
                || move.nextRelativeCell() == null || move.nextDirection() == null) {
            return cluster;
        }
        Cell center = cluster.center();
        Edge nextDoorEdge = move.nextDirection().edgeOf(new Cell(
                center.q() + move.nextRelativeCell().q(),
                center.r() + move.nextRelativeCell().r(),
                move.nextRelativeCell().level()));
        DungeonBoundaryKey oldKey = DungeonBoundaryKey.from(move.oldDoorBoundary().absoluteEdge(center));
        DungeonBoundaryKey nextKey = DungeonBoundaryKey.from(nextDoorEdge);
        if (oldKey.equals(nextKey)) {
            return cluster;
        }
        List<DungeonClusterBoundary> boundaries = new ArrayList<>();
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            if (keptBoundary(boundary, center, oldKey, nextKey)) {
                boundaries.add(boundary);
            }
        }
        boundaries.add(restoredWallBoundary(move.oldDoorBoundary()));
        boundaries.add(new DungeonClusterBoundary(
                cluster.clusterId(),
                move.nextRelativeCell().level(),
                move.nextRelativeCell(),
                move.nextDirection(),
                BoundaryKind.DOOR,
                move.topologyRef()));
        return cluster.withAuthoredBoundaries(DungeonClusterBoundary.orderedByLevel(boundaries));
    }

    private static boolean keptBoundary(
            DungeonClusterBoundary boundary,
            Cell center,
            DungeonBoundaryKey oldKey,
            DungeonBoundaryKey nextKey
    ) {
        if (boundary == null) {
            return false;
        }
        DungeonBoundaryKey boundaryKey = DungeonBoundaryKey.from(boundary.absoluteEdge(center));
        return !(boundary.isDoor() && boundaryKey.equals(oldKey)) && !boundaryKey.equals(nextKey);
    }

    private static DungeonClusterBoundary restoredWallBoundary(DungeonClusterBoundary oldDoorBoundary) {
        return new DungeonClusterBoundary(
                oldDoorBoundary.clusterId(),
                oldDoorBoundary.level(),
                oldDoorBoundary.relativeCell(),
                oldDoorBoundary.direction(),
                BoundaryKind.WALL,
                DungeonTopologyRef.empty());
    }
}
