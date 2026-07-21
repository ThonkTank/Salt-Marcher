package features.dungeon.application.authored;

import java.util.ArrayList;
import java.util.List;

final class DungeonAuthoredCatalogProjectionServiceAssembly {

    private DungeonAuthoredCatalogProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonMapCatalogResponse mapList(
            DungeonAuthoredPublication.Catalog result
    ) {
        return new features.dungeon.api.DungeonMapCatalogResponse.MapList(summaries(result));
    }

    static features.dungeon.api.DungeonMapCatalogResponse mapMutation(
            features.dungeon.api.DungeonMapCatalogResponse.MutationKind kind,
            features.dungeon.domain.core.structure.DungeonMapIdentity mapId
    ) {
        return new features.dungeon.api.DungeonMapCatalogResponse.MapMutation(kind, id(mapId));
    }

    static features.dungeon.api.DungeonMapCatalogResponse mapMutation(
            features.dungeon.api.DungeonMapCatalogResponse.MutationKind kind,
            DungeonAuthoredPublication.MapMutation mutation
    ) {
        return mapMutation(kind, mutation.mapId());
    }

    private static List<features.dungeon.api.DungeonMapSummary> summaries(
            DungeonAuthoredPublication.Catalog result
    ) {
        List<features.dungeon.api.DungeonMapSummary> summaries = new ArrayList<>();
        for (DungeonAuthoredPublication.MapSummary map : result.maps()) {
            summaries.add(summary(map));
        }
        return List.copyOf(summaries);
    }

    private static features.dungeon.api.DungeonMapSummary summary(
            DungeonAuthoredPublication.MapSummary map
    ) {
        return new features.dungeon.api.DungeonMapSummary(
                id(map.mapId()),
                map.mapName(),
                publishedRevision(map.revision()));
    }

    private static features.dungeon.api.DungeonMapId id(
            features.dungeon.domain.core.structure.DungeonMapIdentity identity
    ) {
        return new features.dungeon.api.DungeonMapId(identity == null ? 1L : identity.value());
    }

    private static int publishedRevision(long revision) {
        return revision > Integer.MAX_VALUE ? Integer.MAX_VALUE : Math.max(0, (int) revision);
    }
}
