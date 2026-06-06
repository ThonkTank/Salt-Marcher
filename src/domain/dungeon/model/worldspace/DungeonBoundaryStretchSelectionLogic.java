package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchSelectionLogic {

    // Remove this bridge when boundary-stretch callers use RoomClusterWallMap directly.
    Optional<StretchSelection> resolveStretch(
            DungeonRoomTopologyClusterWork target,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        Optional<src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan.Selection> coreSelection =
                RoomClusterWallMap.fromKeyedRows(rowsByKey(boundaries))
                        .stretchSelection(
                                RoomClusterFloorMap.fromCells(clusterCells(target, sourceEdges)),
                                edges(sourceEdges),
                                deltaQ,
                                deltaR,
                                deltaLevel);
        if (coreSelection.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(StretchSelection.fromCore(coreSelection.get(), boundariesByKey(boundaries)));
    }

    private static Map<EdgeKey, BoundaryRow> rowsByKey(Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries) {
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(edgeKey(entry.getKey()), row(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }

    private static Map<EdgeKey, DungeonClusterBoundary> boundariesByKey(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        Map<EdgeKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(edgeKey(entry.getKey()), entry.getValue());
            }
        }
        return Map.copyOf(result);
    }

    private static Iterable<Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary>> boundaryEntries(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        return boundaries == null ? Map.<DungeonBoundaryKey, DungeonClusterBoundary>of().entrySet() : boundaries.entrySet();
    }

    private static BoundaryRow row(DungeonClusterBoundary boundary) {
        return new BoundaryRow(
                boundary.clusterId(),
                boundary.level(),
                boundary.relativeCell(),
                boundary.direction(),
                boundary.kind());
    }

    private static Iterable<Cell> clusterCells(DungeonRoomTopologyClusterWork target, List<Edge> sourceEdges) {
        if (sourceEdges == null || sourceEdges.isEmpty()) {
            return List.of();
        }
        Edge firstEdge = sourceEdges.getFirst();
        if (firstEdge == null) {
            return List.of();
        }
        List<Cell> result = new ArrayList<>();
        for (Cell cell : target.cellsAt(firstEdge.from().level())) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    private static List<Edge> edges(List<Edge> edges) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : edges == null ? List.<Edge>of() : edges) {
            if (edge == null) {
                return List.of();
            }
            result.add(edge);
        }
        return List.copyOf(result);
    }

    private static EdgeKey edgeKey(DungeonBoundaryKey key) {
        return new EdgeKey(key.lower(), key.upper());
    }

}
