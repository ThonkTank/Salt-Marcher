package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashMap;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class DungeonBoundaryStretchCoreBoundaryRows {

    private DungeonBoundaryStretchCoreBoundaryRows() {
    }

    // Remove this bridge when boundary-stretch callers publish core boundary rows directly.
    static Map<EdgeKey, BoundaryRow> rowsByKey(Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries) {
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(DungeonBoundaryStretchCoreGeometry.key(entry.getKey()), row(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }

    static Map<EdgeKey, DungeonClusterBoundary> boundariesByKey(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        Map<EdgeKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaryEntries(boundaries)) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(DungeonBoundaryStretchCoreGeometry.key(entry.getKey()), entry.getValue());
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
                boundary.relativeCell().geometry(),
                boundary.direction().geometry(),
                kind(boundary.kind()));
    }

    private static BoundaryKind kind(DungeonClusterBoundaryKind kind) {
        if (kind == DungeonClusterBoundaryKind.DOOR) {
            return BoundaryKind.DOOR;
        }
        if (kind == DungeonClusterBoundaryKind.OPEN) {
            return BoundaryKind.OPEN;
        }
        return BoundaryKind.WALL;
    }
}
