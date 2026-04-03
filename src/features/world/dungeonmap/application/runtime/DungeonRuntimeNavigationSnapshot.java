package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

public record DungeonRuntimeNavigationSnapshot(
        Long mapId,
        CellCoord cell,
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
