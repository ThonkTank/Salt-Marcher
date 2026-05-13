package src.data.dungeon.repository;

import java.util.List;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapSummary;

final class DungeonPublishedMapCatalogProjector {

    DungeonMapCatalogResponse catalog(List<SearchDungeonMapsUseCase.MapSummary> maps) {
        return new DungeonMapCatalogResponse.MapList((maps == null ? List.<SearchDungeonMapsUseCase.MapSummary>of() : maps)
                .stream()
                .map(DungeonPublishedMapCatalogProjector::summary)
                .toList());
    }

    DungeonMapCatalogResponse created(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.CREATED, mapId);
    }

    DungeonMapCatalogResponse renamed(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.RENAMED, mapId);
    }

    DungeonMapCatalogResponse deleted(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.DELETED, mapId);
    }

    private static DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary summary) {
        return new DungeonMapSummary(
                DungeonPublishedStateValues.id(summary.mapId()),
                summary.mapName(),
                DungeonPublishedStateValues.revision(summary.revision()));
    }

    private static DungeonMapCatalogResponse mutation(
            DungeonMapCatalogResponse.MutationKind mutationKind,
            DungeonMapIdentity mapId
    ) {
        return new DungeonMapCatalogResponse.MapMutation(mutationKind, DungeonPublishedStateValues.id(mapId));
    }
}
