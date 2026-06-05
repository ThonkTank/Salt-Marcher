package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

final class DungeonBoundaryStretchCoreGeometry {

    private DungeonBoundaryStretchCoreGeometry() {
    }

    // Remove this bridge when boundary-stretch callers use core geometry values directly.
    static Iterable<Cell> clusterCells(DungeonRoomTopologyClusterWork target, List<DungeonEdge> sourceEdges) {
        if (sourceEdges == null || sourceEdges.isEmpty()) {
            return List.of();
        }
        DungeonEdge firstEdge = sourceEdges.getFirst();
        if (firstEdge == null || firstEdge.from() == null) {
            return List.of();
        }
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : target.cellsAt(firstEdge.from().level())) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }

    static List<Edge> edges(List<DungeonEdge> edges) {
        List<Edge> result = new ArrayList<>();
        for (DungeonEdge edge : edges == null ? List.<DungeonEdge>of() : edges) {
            if (edge == null || edge.from() == null || edge.to() == null) {
                return List.of();
            }
            result.add(edge(edge));
        }
        return List.copyOf(result);
    }

    static Edge edge(DungeonEdge edge) {
        return new Edge(edge.from().geometry(), edge.to().geometry());
    }

    static DungeonEdge dungeonEdge(Edge edge) {
        return new DungeonEdge(
                DungeonCell.fromGeometry(edge.from()),
                DungeonCell.fromGeometry(edge.to()));
    }

    static EdgeKey key(DungeonBoundaryKey key) {
        return new EdgeKey(key.lower().geometry(), key.upper().geometry());
    }

    static DungeonBoundaryKey dungeonKey(EdgeKey key) {
        return new DungeonBoundaryKey(
                DungeonCell.fromGeometry(key.lower()),
                DungeonCell.fromGeometry(key.upper()));
    }
}
