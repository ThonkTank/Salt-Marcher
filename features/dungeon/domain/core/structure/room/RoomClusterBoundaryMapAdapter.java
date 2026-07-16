package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomClusterBoundaryMapAdapter {
    private RoomClusterBoundaryMapAdapter() {
    }

    static BoundaryMap boundaryMap(Map<EdgeKey, BoundaryRow> rowsByKey) {
        List<BoundarySegment> segments = new ArrayList<>();
        for (Map.Entry<EdgeKey, BoundaryRow> entry : rowsByKey.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                segments.add(new BoundarySegment(entry.getKey(), boundaryKind(entry.getValue().kind())));
            }
        }
        return new BoundaryMap(segments);
    }

    private static features.dungeon.domain.core.component.boundary.BoundaryKind boundaryKind(BoundaryKind kind) {
        return switch (kind == null ? BoundaryKind.WALL : kind) {
            case WALL -> features.dungeon.domain.core.component.boundary.BoundaryKind.wall();
            case DOOR -> features.dungeon.domain.core.component.boundary.BoundaryKind.door();
            case OPEN -> features.dungeon.domain.core.component.boundary.BoundaryKind.open();
        };
    }
}
