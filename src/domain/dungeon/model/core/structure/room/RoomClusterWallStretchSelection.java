package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomBoundaryStretchValues.StretchSelection;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomClusterWallStretchSelection {

    private RoomClusterWallStretchSelection() {
    }

    static Optional<StretchSelection> resolve(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            RoomClusterFloorMap floorMap,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Optional<RoomClusterBoundaryStretchPlan.Selection> selection =
                RoomClusterWallMap.fromKeyedRows(rowsByKey(boundaries))
                        .stretchSelection(floorMap, sourceEdges, deltaQ, deltaR, deltaLevel);
        return selection.map(value -> StretchSelection.fromCore(value, boundariesByKey(boundaries)));
    }

    private static Map<EdgeKey, BoundaryRow> rowsByKey(Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries) {
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            result.put(edgeKey(entry.getKey()), row(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<EdgeKey, DungeonClusterBoundary> boundariesByKey(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        Map<EdgeKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            result.put(edgeKey(entry.getKey()), entry.getValue());
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
