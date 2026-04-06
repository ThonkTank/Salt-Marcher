package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Objects;

public record DoorRef(
        DoorOwnerType ownerType,
        Long ownerId,
        int levelZ,
        GridSegment2x anchorSegment2x
) {

    public DoorRef {
        ownerType = Objects.requireNonNull(ownerType, "ownerType");
        anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
    }
}
