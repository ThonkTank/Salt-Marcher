package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.List;

public record DungeonRuntimeRenderOverlay(
        CubePoint activeTile,
        CardinalDirection heading,
        List<DungeonDoorNumberOverlay> doorNumbers
) {
    public DungeonRuntimeRenderOverlay {
        heading = heading == null ? CardinalDirection.defaultDirection() : heading;
        doorNumbers = doorNumbers == null ? List.of() : List.copyOf(doorNumbers);
    }

    public static DungeonRuntimeRenderOverlay empty() {
        return new DungeonRuntimeRenderOverlay(null, CardinalDirection.defaultDirection(), List.of());
    }
}
