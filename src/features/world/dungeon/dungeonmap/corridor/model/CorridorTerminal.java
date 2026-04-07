package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;

import java.util.Objects;

/**
 * Persisted authored endpoint for a corridor member or root start.
 */
public sealed interface CorridorTerminal permits CorridorTerminal.DoorTerminal, CorridorTerminal.PointTerminal {

    record DoorTerminal(DoorRef doorRef) implements CorridorTerminal {
        public DoorTerminal {
            doorRef = Objects.requireNonNull(doorRef, "doorRef");
        }
    }

    record PointTerminal(GridPoint point) implements CorridorTerminal {
        public PointTerminal {
            point = Objects.requireNonNull(point, "point");
        }
    }
}
