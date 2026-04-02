package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;

/**
 * Corridor routing geometry stays in `point2x`; `roomRelativeCell` remains the room-local cell binding for room-bound
 * endpoints and is not a 2x mirror.
 */
public record CorridorNode(
        Long nodeId,
        LegacyGridPoint2x point2x,
        Long roomId,
        Point2i roomRelativeCell,
        CardinalDirection roomBoundaryDirection
) {

    public CorridorNode {
        point2x = point2x == null ? LegacyGridPoint2x.fromRaw(0, 0) : point2x;
        boolean hasRoomBinding = roomId != null || roomRelativeCell != null || roomBoundaryDirection != null;
        if (hasRoomBinding && (roomId == null || roomRelativeCell == null || roomBoundaryDirection == null)) {
            throw new IllegalArgumentException("Corridor node room binding must be all-or-none");
        }
    }

    public boolean isRoomBound() {
        return roomId != null;
    }
}
