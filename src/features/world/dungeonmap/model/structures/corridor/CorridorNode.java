package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;

import java.util.Objects;

/**
 * Corridor routing geometry stays in `point2x`; room-bound endpoints keep their absolute room cell directly in memory
 * and in storage.
 */
public record CorridorNode(
        Long nodeId,
        GridPoint2x point2x,
        Long roomId,
        CellCoord roomCell,
        CardinalDirection roomBoundaryDirection
) {

    public CorridorNode {
        point2x = Objects.requireNonNull(point2x, "point2x");
        boolean hasRoomBinding = roomId != null || roomCell != null || roomBoundaryDirection != null;
        if (hasRoomBinding && (roomId == null || roomCell == null || roomBoundaryDirection == null)) {
            throw new IllegalArgumentException("Corridor node room binding must be all-or-none");
        }
    }

    public boolean isRoomBound() {
        return roomId != null;
    }
}
