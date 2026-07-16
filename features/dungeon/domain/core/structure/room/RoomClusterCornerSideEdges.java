package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;

final class RoomClusterCornerSideEdges {
    private RoomClusterCornerSideEdges() {
    }

    static List<Edge> adjacentWallRunEdges(
            DungeonRoomCluster cluster,
            Cell corner,
            boolean vertical
    ) {
        if (cluster == null || corner == null) {
            return List.of();
        }
        List<Edge> result = new ArrayList<>();
        for (EdgeKey key : cluster.boundarySnapshot().adjacentWallRunEdgeKeys(corner, vertical)) {
            result.add(new Edge(key.lower(), key.upper()));
        }
        return List.copyOf(result);
    }
}
