package src.domain.dungeon.application;

import java.util.List;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapSummary;

public final class DungeonCatalogProjector {

    private DungeonCatalogProjector() {
    }

    public static DungeonMapCatalogResponse mapList(List<SearchDungeonMapsUseCase.MapSummary> summaries) {
        return new DungeonMapCatalogResponse.MapList(summaries.stream().map(DungeonCatalogProjector::summary).toList());
    }

    public static DungeonMapCatalogResponse created(CreateDungeonMapUseCase.CreatedMap result) {
        return mutation(DungeonMapCatalogResponse.MutationKind.CREATED, result.mapId());
    }

    public static DungeonMapCatalogResponse renamed(RenameDungeonMapUseCase.RenamedMap result) {
        return mutation(DungeonMapCatalogResponse.MutationKind.RENAMED, result.mapId());
    }

    public static DungeonMapCatalogResponse deleted(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.DELETED, mapId);
    }

    private static DungeonMapCatalogResponse mutation(
            DungeonMapCatalogResponse.MutationKind kind,
            DungeonMapIdentity mapId
    ) {
        return new DungeonMapCatalogResponse.MapMutation(kind, DungeonIdentityBoundaryTranslator.id(mapId));
    }

    private static DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary summary) {
        return new DungeonMapSummary(
                DungeonIdentityBoundaryTranslator.id(summary.mapId()),
                summary.mapName(),
                summary.revision());
    }
}
