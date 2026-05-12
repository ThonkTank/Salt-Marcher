package src.data.dungeon.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapSummary;

final class DungeonPublishedMapCatalogProjector {

    DungeonMapCatalogResponse catalog(List<SearchDungeonMapsUseCase.MapSummary> maps) {
        return new DungeonMapCatalogResponse.MapList((maps == null ? List.<SearchDungeonMapsUseCase.MapSummary>of() : maps)
                .stream()
                .map(DungeonPublishedMapCatalogProjector::summary)
                .toList());
    }

    DungeonMapCatalogResponse mutation(
            DungeonPublishedStateRepository.CatalogMutationKind mutationKind,
            @Nullable DungeonMapIdentity mapId
    ) {
        return new DungeonMapCatalogResponse.MapMutation(mutationKind(mutationKind), DungeonPublishedStateValues.id(mapId));
    }

    private static DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary summary) {
        return new DungeonMapSummary(
                DungeonPublishedStateValues.id(summary.mapId()),
                summary.mapName(),
                DungeonPublishedStateValues.revision(summary.revision()));
    }

    private static DungeonMapCatalogResponse.MutationKind mutationKind(
            DungeonPublishedStateRepository.CatalogMutationKind mutationKind
    ) {
        return switch (mutationKind) {
            case CREATED -> DungeonMapCatalogResponse.MutationKind.CREATED;
            case RENAMED -> DungeonMapCatalogResponse.MutationKind.RENAMED;
            case DELETED -> DungeonMapCatalogResponse.MutationKind.DELETED;
        };
    }
}
