package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.geometry.GridPoint;

import java.util.Objects;

/**
 * Persisted authored corridor input node. A node is either fixed to a room door or to an explicit grid point.
 */
public record CorridorInputNode(
        Long nodeId,
        DoorRef doorRef,
        GridPoint fixedPoint
) {
    public CorridorInputNode {
        if ((doorRef == null) == (fixedPoint == null)) {
            throw new IllegalArgumentException("Corridor input node must define exactly one anchor");
        }
    }

    public boolean isDoorBound() {
        return doorRef != null;
    }

    public GridPoint authoredPoint() {
        return Objects.requireNonNullElse(fixedPoint, null);
    }
}
