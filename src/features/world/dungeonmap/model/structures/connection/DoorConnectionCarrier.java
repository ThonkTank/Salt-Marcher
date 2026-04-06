package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.DoorRef;

import java.util.Objects;

public record DoorConnectionCarrier(DoorRef doorRef, GridSegment2x anchorSegment2x) implements ConnectionCarrier {

    public DoorConnectionCarrier {
        doorRef = Objects.requireNonNull(doorRef, "doorRef");
        anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
    }
}
