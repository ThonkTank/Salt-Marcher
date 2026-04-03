package features.world.dungeonmap.loading;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.DungeonLayout;

import java.util.List;

record DungeonMapLoadResolution(
        List<DungeonMapCatalogEntry> maps,
        DungeonLayout activeMap,
        String errorMessage
) {
    DungeonMapLoadResolution {
        maps = maps == null ? List.of() : List.copyOf(maps);
    }
}
