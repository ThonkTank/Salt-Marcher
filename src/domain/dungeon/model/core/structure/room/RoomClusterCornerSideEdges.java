package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

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
