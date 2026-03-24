package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CardinalDirection;

public record DungeonRuntimeNavigationSnapshot(
        Long mapId,
        DungeonRuntimeLocation activeLocation,
        CardinalDirection heading
) {

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null, null, CardinalDirection.defaultDirection());
    }
}
