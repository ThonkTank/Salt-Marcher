package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import java.util.ArrayList;
import java.util.List;

final class RoomClusterDoorBoundaryMovement {

    RoomCluster moved(RoomCluster cluster, RoomClusterDoorBoundaryMove move) {
        if (cluster == null || move == null || move.oldDoorBoundary() == null || move.nextEdge() == null) {
            return cluster;
        }
        DungeonBoundaryKey oldKey = DungeonBoundaryKey.from(move.oldDoorBoundary().edge());
        DungeonBoundaryKey nextKey = DungeonBoundaryKey.from(move.nextEdge());
        if (oldKey.equals(nextKey)) {
            return cluster;
        }
        List<BoundarySegment> boundaries = new ArrayList<>();
        for (BoundarySegment boundary : cluster.orderedAuthoredBoundaries()) {
            DungeonBoundaryKey boundaryKey = DungeonBoundaryKey.from(boundary.edge());
            if (!(boundary.isDoor() && boundaryKey.equals(oldKey)) && !boundaryKey.equals(nextKey)) {
                boundaries.add(boundary);
            }
        }
        boundaries.add(new BoundarySegment(
                move.oldDoorBoundary().edgeKey(),
                BoundaryKind.WALL,
                DungeonTopologyRef.empty()));
        boundaries.add(BoundarySegment.fromEdge(move.nextEdge(), BoundaryKind.DOOR, move.topologyRef()));
        return cluster.withAuthoredBoundaries(boundaries);
    }
}
