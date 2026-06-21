package src.domain.dungeon.model.core.structure.room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

public final class RoomClusterWallDeleteResolver {
    private final Map<EdgeKey, Edge> wallsByKey;

    RoomClusterWallDeleteResolver(Map<EdgeKey, Edge> wallsByKey) {
        this.wallsByKey = new LinkedHashMap<>(wallsByKey == null ? Map.of() : wallsByKey);
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
