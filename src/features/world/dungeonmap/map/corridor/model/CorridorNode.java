package features.world.dungeonmap.map.corridor.model;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.map.structure.model.boundary.door.DoorRef;

import java.util.Objects;

/**
 * Corridor graph nodes own only route geometry plus an optional reference to the already-owned exterior room door they
 * attach to. Room cell and boundary direction are derived from that canonical door through the current layout.
 */
public record CorridorNode(
        Long nodeId,
        GridPoint point,
        DoorRef doorRef
) {

    public CorridorNode {
        point = Objects.requireNonNull(point, "point");
    }

    public boolean isDoorBound() {
        return doorRef != null;
    }
}
