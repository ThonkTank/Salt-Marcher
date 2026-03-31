package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;

public record CorridorNode(
        Long nodeId,
        int gridX2,
        int gridY2,
        Long roomId,
        Point2i roomRelativeCell,
        CardinalDirection roomBoundaryDirection
) {

    public CorridorNode {
        boolean hasRoomBinding = roomId != null || roomRelativeCell != null || roomBoundaryDirection != null;
        if (hasRoomBinding && (roomId == null || roomRelativeCell == null || roomBoundaryDirection == null)) {
            throw new IllegalArgumentException("Corridor node room binding must be all-or-none");
        }
    }

    public boolean isRoomBound() {
        return roomId != null;
    }
}
