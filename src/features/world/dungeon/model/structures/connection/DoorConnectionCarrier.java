package features.world.dungeon.model.structures.connection;

import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;

import java.util.Objects;

public record DoorConnectionCarrier(DoorRef doorRef) implements ConnectionCarrier {

    public DoorConnectionCarrier {
        doorRef = Objects.requireNonNull(doorRef, "doorRef");
    }
}
