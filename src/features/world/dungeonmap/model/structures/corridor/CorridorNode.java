package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;

import java.util.Objects;

/**
 * Corridor graph nodes own only route geometry plus an optional reference to the already-owned exterior room door they
 * attach to. Room cell and boundary direction are derived from that canonical door through the current layout.
 */
public record CorridorNode(
        Long nodeId,
        GridPoint2x point2x,
        DoorRef doorRef
) {

    public CorridorNode {
        point2x = Objects.requireNonNull(point2x, "point2x");
    }

    public boolean isDoorBound() {
        return doorRef != null;
    }
}
