package features.world.dungeon.application.runtime;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;

public record DungeonRuntimeNavigationSnapshot(
        Long mapId,
        GridPoint cell,
        int levelZ,
        CardinalDirection heading
) {
    public DungeonRuntimeNavigationSnapshot {
        heading = heading == null ? CardinalDirection.defaultDirection() : heading;
    }

    public boolean isEmpty() {
        return mapId == null || cell == null;
    }

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null, null, 0, CardinalDirection.defaultDirection());
    }
}
