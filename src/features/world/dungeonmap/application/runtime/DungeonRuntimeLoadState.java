package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.domain.model.DungeonMap;
import features.world.dungeonmap.domain.model.DungeonRuntimeState;

import java.util.List;

public record DungeonRuntimeLoadState(
        List<DungeonMap> maps,
        long selectedMapId,
        DungeonRuntimeState state
) {
}
