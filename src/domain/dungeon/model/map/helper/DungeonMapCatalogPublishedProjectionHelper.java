package src.domain.dungeon.model.map.helper;

import java.util.List;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapSummary;

public final class DungeonMapCatalogPublishedProjectionHelper {

    public DungeonMapCatalogResponse catalog(List<DungeonMapSummary> maps) {
        return new DungeonMapCatalogResponse.MapList(maps == null ? List.of() : List.copyOf(maps));
    }

    public DungeonMapSummary summary(
            DungeonMapIdentity mapId,
            String mapName,
            long revision
    ) {
        return new DungeonMapSummary(
                DungeonPublishedStateValueHelper.id(mapId),
                mapName,
                DungeonPublishedStateValueHelper.revision(revision));
    }

    public DungeonMapCatalogResponse created(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.CREATED, mapId);
    }

    public DungeonMapCatalogResponse renamed(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.RENAMED, mapId);
    }

    public DungeonMapCatalogResponse deleted(DungeonMapIdentity mapId) {
        return mutation(DungeonMapCatalogResponse.MutationKind.DELETED, mapId);
    }

    private static DungeonMapCatalogResponse mutation(
            DungeonMapCatalogResponse.MutationKind mutationKind,
            DungeonMapIdentity mapId
    ) {
        return new DungeonMapCatalogResponse.MapMutation(mutationKind, DungeonPublishedStateValueHelper.id(mapId));
    }
}
