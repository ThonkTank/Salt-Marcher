package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;

final class DungeonAuthoredCatalogProjectionServiceAssembly {

    private DungeonAuthoredCatalogProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonMapCatalogResponse mapList(
            DungeonAuthoredPublication.Catalog result
    ) {
        return new src.domain.dungeon.published.DungeonMapCatalogResponse.MapList(summaries(result));
    }

    static src.domain.dungeon.published.DungeonMapCatalogResponse mapMutation(
            src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind kind,
            src.domain.dungeon.model.core.structure.DungeonMapIdentity mapId
    ) {
        return new src.domain.dungeon.published.DungeonMapCatalogResponse.MapMutation(kind, id(mapId));
    }

    static src.domain.dungeon.published.DungeonMapCatalogResponse mapMutation(
            src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind kind,
            DungeonAuthoredPublication.MapMutation mutation
    ) {
        return mapMutation(kind, mutation.mapId());
    }

    private static List<src.domain.dungeon.published.DungeonMapSummary> summaries(
            DungeonAuthoredPublication.Catalog result
    ) {
        List<src.domain.dungeon.published.DungeonMapSummary> summaries = new ArrayList<>();
        for (DungeonAuthoredPublication.MapSummary map : result.maps()) {
            summaries.add(summary(map));
        }
        return List.copyOf(summaries);
    }

    private static src.domain.dungeon.published.DungeonMapSummary summary(
            DungeonAuthoredPublication.MapSummary map
    ) {
        return new src.domain.dungeon.published.DungeonMapSummary(
                id(map.mapId()),
                map.mapName(),
                DungeonPublishedMapProjectionServiceAssembly.revision(map.revision()));
    }

    private static src.domain.dungeon.published.DungeonMapId id(
            src.domain.dungeon.model.core.structure.DungeonMapIdentity identity
    ) {
        return new src.domain.dungeon.published.DungeonMapId(identity == null ? 1L : identity.value());
    }
}
