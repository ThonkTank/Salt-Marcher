package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import src.domain.dungeon.model.core.component.boundary.BoundaryMap;
import src.domain.dungeon.model.core.geometry.Cell;

final class RoomClusterBoundaryVertices {

    private RoomClusterBoundaryVertices() {
    }

    static List<Cell> authored(BoundaryMap boundaryMap, int level) {
        return boundaryMap == null
                ? List.of()
                : boundaryMap.boundaryCornersAt(level).stream()
                        .map(src.domain.dungeon.model.core.component.boundary.BoundaryCorner::cell)
                        .toList();
    }
}
