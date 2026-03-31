package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;

/**
 * Canonical corridor graph node in doubled-grid 2D space.
 *
 * <p>Optional room binding includes both the room cell and the exact room boundary direction that should become the
 * door edge. That information is part of corridor truth and must not be guessed later.
 */
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
