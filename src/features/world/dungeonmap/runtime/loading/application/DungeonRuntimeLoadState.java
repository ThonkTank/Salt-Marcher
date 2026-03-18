package features.world.dungeonmap.runtime.loading.application;

import features.world.dungeonmap.corridors.model.CorridorTopology;
import features.world.dungeonmap.catalog.model.DungeonMap;
import features.world.dungeonmap.runtime.model.DungeonRuntimeState;

import java.util.List;

public record DungeonRuntimeLoadState(
        List<DungeonMap> maps,
        long selectedMapId,
        DungeonRuntimeState state,
        CorridorTopology corridorTopology
) {
}
