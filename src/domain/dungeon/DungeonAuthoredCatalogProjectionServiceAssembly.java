package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;

final class DungeonAuthoredCatalogProjectionServiceAssembly {

    private DungeonAuthoredCatalogProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonMapCatalogResponse mapList(
            src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository.CatalogPublication result
    ) {
        return new src.domain.dungeon.published.DungeonMapCatalogResponse.MapList(summaries(result));
    }

    static src.domain.dungeon.published.DungeonMapCatalogResponse mapMutation(
            src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind kind,
            src.domain.dungeon.model.worldspace.DungeonMapIdentity mapId
    ) {
        return new src.domain.dungeon.published.DungeonMapCatalogResponse.MapMutation(kind, id(mapId));
    }

    private static List<src.domain.dungeon.published.DungeonMapSummary> summaries(
            src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository.CatalogPublication result
    ) {
        List<src.domain.dungeon.published.DungeonMapSummary> summaries = new ArrayList<>();
        for (src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository.MapSummaryPublication map :
                result == null
                        ? List.<src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository.MapSummaryPublication>of()
                        : result.maps()) {
            summaries.add(summary(map));
        }
        return List.copyOf(summaries);
    }

    private static src.domain.dungeon.published.DungeonMapSummary summary(
            src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository.MapSummaryPublication map
    ) {
        return new src.domain.dungeon.published.DungeonMapSummary(
                id(map.mapId()),
                map.mapName(),
                DungeonPublishedMapProjectionServiceAssembly.revision(map.revision()));
    }

    private static src.domain.dungeon.published.DungeonMapId id(
            src.domain.dungeon.model.worldspace.DungeonMapIdentity identity
    ) {
        return new src.domain.dungeon.published.DungeonMapId(identity == null ? 1L : identity.value());
    }
}
