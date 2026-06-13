package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.component.boundary.BoundaryMap;
import src.domain.dungeon.model.core.component.boundary.BoundarySegment;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

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

    private static src.domain.dungeon.model.core.component.boundary.BoundaryKind boundaryKind(BoundaryKind kind) {
        return switch (kind == null ? BoundaryKind.WALL : kind) {
            case WALL -> src.domain.dungeon.model.core.component.boundary.BoundaryKind.wall();
            case DOOR -> src.domain.dungeon.model.core.component.boundary.BoundaryKind.door();
            case OPEN -> src.domain.dungeon.model.core.component.boundary.BoundaryKind.open();
        };
    }
}
