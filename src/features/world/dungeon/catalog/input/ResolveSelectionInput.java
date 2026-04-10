package features.world.dungeon.catalog.input;

import java.util.List;
import java.util.Set;

@SuppressWarnings("unused")
public record ResolveSelectionInput(
        List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> maps,
        Long requestedMapId,
        List<Long> preferredMapIds,
        Set<Long> excludedMapIds
) {
    public ResolveSelectionInput {
        maps = maps == null ? List.of() : List.copyOf(maps);
        preferredMapIds = preferredMapIds == null ? List.of() : List.copyOf(preferredMapIds);
        excludedMapIds = excludedMapIds == null ? Set.of() : Set.copyOf(excludedMapIds);
    }

    public record ResolvedSelectionInput(
            List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> maps,
            features.world.dungeon.catalog.application.DungeonMapCatalogEntry requestedMap,
            List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> candidateMaps
    ) {
        public ResolvedSelectionInput {
            maps = maps == null ? List.of() : List.copyOf(maps);
            candidateMaps = candidateMaps == null ? List.of() : List.copyOf(candidateMaps);
        }
    }
}
