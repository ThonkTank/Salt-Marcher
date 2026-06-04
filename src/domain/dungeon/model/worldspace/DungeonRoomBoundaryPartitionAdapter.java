package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

// Remove this bridge when room boundary partition callers pass Core boundary facts directly.
final class DungeonRoomBoundaryPartitionAdapter {

    Map<Integer, List<Edge>> closedBoundaryEdgesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            @Nullable DungeonCell center
    ) {
        Map<Integer, List<Edge>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : sourceEntries(boundariesByLevel)) {
            List<Edge> edges = closedBoundaryEdges(entry.getValue(), center);
            if (!edges.isEmpty()) {
                result.put(entry.getKey(), edges);
            }
        }
        return Map.copyOf(result);
    }

    private static Iterable<Map.Entry<Integer, List<DungeonClusterBoundary>>> sourceEntries(
            @Nullable Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return boundariesByLevel == null
                ? List.<Map.Entry<Integer, List<DungeonClusterBoundary>>>of()
                : boundariesByLevel.entrySet();
    }

    private static List<Edge> closedBoundaryEdges(
            @Nullable List<DungeonClusterBoundary> boundaries,
            @Nullable DungeonCell center
    ) {
        List<Edge> result = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            Edge edge = closedBoundaryEdge(boundary, center);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable Edge closedBoundaryEdge(
            @Nullable DungeonClusterBoundary boundary,
            @Nullable DungeonCell center
    ) {
        if (boundary == null || boundary.isOpen() || center == null) {
            return null;
        }
        DungeonEdge edge = boundary.absoluteEdge(center);
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        return new Edge(coreCell(edge.from()), coreCell(edge.to()));
    }

    private static Cell coreCell(DungeonCell cell) {
        return cell.geometry();
    }
}
