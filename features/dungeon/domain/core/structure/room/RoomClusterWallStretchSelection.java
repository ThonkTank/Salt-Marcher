package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.Selection;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomClusterWallStretchSelection {

    private RoomClusterWallStretchSelection() {
    }

    static Optional<Selection> resolve(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            RoomClusterFloorMap floorMap,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return RoomClusterWallMap.fromKeyedRows(rowsByKey(boundaries))
                .stretchSelection(floorMap, sourceEdges, deltaQ, deltaR, deltaLevel);
    }

    private static Map<EdgeKey, BoundaryRow> rowsByKey(Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries) {
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            result.put(edgeKey(entry.getKey()), row(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary>> boundaryEntries(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        List<Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary>> result = new ArrayList<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry
                : (boundaries == null ? Map.<DungeonBoundaryKey, DungeonClusterBoundary>of() : boundaries).entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.add(entry);
            }
        }
        return List.copyOf(result);
    }

    private static BoundaryRow row(DungeonClusterBoundary boundary) {
        return new BoundaryRow(
                boundary.clusterId(),
                boundary.level(),
                boundary.relativeCell(),
                boundary.direction(),
                boundary.kind());
    }

    private static EdgeKey edgeKey(DungeonBoundaryKey key) {
        return new EdgeKey(key.lower(), key.upper());
    }
}
