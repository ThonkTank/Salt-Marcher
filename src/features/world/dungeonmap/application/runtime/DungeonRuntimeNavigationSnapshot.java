package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

public record DungeonRuntimeNavigationSnapshot(
        Long mapId,
        CellCoord cell,
        int levelZ,
        CardinalDirection heading
) {

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null, null, 0, CardinalDirection.defaultDirection());
    }
}
