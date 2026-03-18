package features.world.dungeonmap.runtime.model;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;

public record DungeonRuntimeState(
        DungeonLayout layout,
        DungeonRuntimeLocation activeLocation
) {
}
