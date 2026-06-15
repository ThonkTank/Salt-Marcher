package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

final class RoomClusterDoorBoundaryMovement {

    DungeonRoomCluster moved(DungeonRoomCluster cluster, RoomClusterDoorBoundaryMove move) {
        if (cluster == null || move == null || move.oldDoorEdge() == null
                || move.nextRelativeCell() == null || move.nextDirection() == null) {
            return cluster;
        }
        Cell center = cluster.center();
        Edge nextDoorEdge = move.nextDirection().edgeOf(new Cell(
                center.q() + move.nextRelativeCell().q(),
                center.r() + move.nextRelativeCell().r(),
                move.nextRelativeCell().level()));
        DungeonBoundaryKey oldKey = DungeonBoundaryKey.from(move.oldDoorEdge());
        DungeonBoundaryKey nextKey = DungeonBoundaryKey.from(nextDoorEdge);
        List<DungeonClusterBoundary> boundaries = new ArrayList<>();
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            if (keptBoundary(boundary, center, oldKey, nextKey)) {
                boundaries.add(boundary);
            }
        }
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
}
