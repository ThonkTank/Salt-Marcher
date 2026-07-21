package features.dungeon.domain.core.structure.room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;

public final class RoomClusterWallDeleteResolver {
    private final Map<EdgeKey, Edge> wallsByKey;

    RoomClusterWallDeleteResolver(Map<EdgeKey, Edge> wallsByKey) {
        this.wallsByKey = new LinkedHashMap<>(wallsByKey == null ? Map.of() : wallsByKey);
    }

    public static RoomClusterWallDeleteResolver authored(Iterable<Edge> authoredWallEdges) {
        return new RoomClusterWallDeleteResolver(RoomClusterWallRunEdges.keyed(authoredWallEdges));
    }

    public List<Edge> deleteEdges(Iterable<Edge> targetEdges) {
        return RoomClusterWallRunDelete.authoredWallDeleteEdges(wallsByKey, targetEdges);
    }

    public RoomClusterWallDeleteTarget deleteTarget(Iterable<Cell> clusterCells, Edge targetEdge) {
        return RoomClusterWallRunDelete.authoredWallDeleteTarget(clusterCells, wallsByKey, targetEdge);
    }

    public RoomClusterWallDeleteTarget cornerDeleteTarget(Iterable<Cell> clusterCells, Cell corner) {
        return RoomClusterWallRunDelete.authoredWallCornerDeleteTarget(clusterCells, wallsByKey, corner);
    }

    public RoomClusterWallDeleteTarget cellDeleteTarget(Iterable<Cell> clusterCells, Cell cell) {
        return RoomClusterWallRunDelete.authoredWallCellDeleteTarget(clusterCells, wallsByKey, cell);
    }
}
