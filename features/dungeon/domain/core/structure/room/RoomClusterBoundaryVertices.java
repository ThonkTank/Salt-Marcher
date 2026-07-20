package features.dungeon.domain.core.structure.room;

import java.util.List;
import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.geometry.Cell;

final class RoomClusterBoundaryVertices {

    private RoomClusterBoundaryVertices() {
    }

    static List<Cell> authored(BoundaryMap boundaryMap, int level) {
        return boundaryMap == null
                ? List.of()
                : boundaryMap.boundaryCornersAt(level).stream()
                        .map(features.dungeon.domain.core.component.boundary.BoundaryCorner::cell)
                        .toList();
    }
}
