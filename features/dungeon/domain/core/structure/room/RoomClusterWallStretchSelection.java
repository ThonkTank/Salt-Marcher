package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.Selection;

final class RoomClusterWallStretchSelection {

    private RoomClusterWallStretchSelection() {
    }

    static Optional<Selection> resolve(
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            RoomClusterFloorMap floorMap,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return RoomClusterBoundaryStretchPlan.resolve(
                floorMap == null ? List.of() : floorMap.allCells(),
                sourceEdges,
                segmentsByKey(boundaries),
                deltaQ,
                deltaR,
                deltaLevel);
    }

    private static Map<EdgeKey, BoundarySegment> segmentsByKey(Map<DungeonBoundaryKey, BoundarySegment> boundaries) {
        Map<EdgeKey, BoundarySegment> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, BoundarySegment> entry : boundaryEntries(boundaries)) {
            result.put(edgeKey(entry.getKey()), entry.getValue());
        }
        return Map.copyOf(result);
    }

    private static List<Map.Entry<DungeonBoundaryKey, BoundarySegment>> boundaryEntries(
            Map<DungeonBoundaryKey, BoundarySegment> boundaries
    ) {
        List<Map.Entry<DungeonBoundaryKey, BoundarySegment>> result = new ArrayList<>();
        for (Map.Entry<DungeonBoundaryKey, BoundarySegment> entry
                : (boundaries == null ? Map.<DungeonBoundaryKey, BoundarySegment>of() : boundaries).entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.add(entry);
            }
        }
        return List.copyOf(result);
    }

    private static EdgeKey edgeKey(DungeonBoundaryKey key) {
        return new EdgeKey(key.lower(), key.upper());
    }
}
