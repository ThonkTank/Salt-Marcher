package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRuntimeState;

import java.util.List;

record DungeonRuntimeLoadState(
        List<DungeonMap> maps,
        long selectedMapId,
        DungeonRuntimeState state
) {
}
