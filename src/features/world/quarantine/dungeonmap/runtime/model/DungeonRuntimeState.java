package features.world.quarantine.dungeonmap.runtime.model;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;

public record DungeonRuntimeState(
        DungeonLayout layout,
        DungeonRuntimeLocation activeLocation
) {
}
