package features.world.dungeonmap.loading;

import features.world.dungeonmap.model.DungeonLayout;

import java.util.List;

public record DungeonMapLoadResult(
        List<DungeonMapCatalogEntry> maps,
        DungeonLayout activeMap,
        String errorMessage
) {
    public DungeonMapLoadResult {
        maps = maps == null ? List.of() : List.copyOf(maps);
    }
}
