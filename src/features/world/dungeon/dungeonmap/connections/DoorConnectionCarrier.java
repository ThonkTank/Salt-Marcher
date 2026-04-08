package features.world.dungeon.dungeonmap.connections;

import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;

import java.util.Objects;

public record DoorConnectionCarrier(DoorRef doorRef) implements ConnectionCarrier {

    public DoorConnectionCarrier {
        doorRef = Objects.requireNonNull(doorRef, "doorRef");
    }
}
