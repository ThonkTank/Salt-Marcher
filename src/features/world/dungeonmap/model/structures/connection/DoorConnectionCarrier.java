package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.Door;

import java.util.Objects;

public record DoorConnectionCarrier(
        Door door,
        GridSegment2x anchorSegment2x
) implements ConnectionCarrier {

    public DoorConnectionCarrier {
        door = Objects.requireNonNull(door, "door");
        anchorSegment2x = anchorSegment2x == null
                ? door.segments2x().stream().sorted(GridSegment2x.ORDER).findFirst().orElse(null)
                : anchorSegment2x;
        anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
    }
}
