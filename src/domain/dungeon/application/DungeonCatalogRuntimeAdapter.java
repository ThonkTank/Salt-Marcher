package src.domain.dungeon.application;

import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapCatalogRequest;
import src.domain.dungeon.published.DungeonMapCatalogResponse;

public final class DungeonCatalogRuntimeAdapter {

    private final Function<String, List<SearchDungeonMapsUseCase.MapSummary>> searchMapsPath;
    private final Function<String, CreateDungeonMapUseCase.CreatedMap> createMapPath;
    private final BiFunction<DungeonMapIdentity, String, RenameDungeonMapUseCase.RenamedMap> renameMapPath;
    private final Function<DungeonMapIdentity, DungeonMapIdentity> deleteMapPath;

    public DungeonCatalogRuntimeAdapter(
            SearchDungeonMapsUseCase searchDungeonMapsUseCase,
            CreateDungeonMapUseCase createDungeonMapUseCase,
            RenameDungeonMapUseCase renameDungeonMapUseCase,
            DeleteDungeonMapUseCase deleteDungeonMapUseCase
    ) {
        this.searchMapsPath = searchDungeonMapsUseCase::execute;
        this.createMapPath = createDungeonMapUseCase::execute;
        this.renameMapPath = renameDungeonMapUseCase::execute;
        this.deleteMapPath = deleteDungeonMapUseCase::execute;
    }

    public DungeonMapCatalogResponse handle(@Nullable DungeonMapCatalogRequest request) {
        DungeonMapCatalogRequest effectiveRequest = request == null
                ? new DungeonMapCatalogRequest.Search("")
                : request;
        if (effectiveRequest instanceof DungeonMapCatalogRequest.Search search) {
            return DungeonCatalogProjector.mapList(searchMapsPath.apply(search.query()));
        }
        if (effectiveRequest instanceof DungeonMapCatalogRequest.CreateMap createMap) {
            return DungeonCatalogProjector.created(createMapPath.apply(createMap.mapName()));
        }
        if (effectiveRequest instanceof DungeonMapCatalogRequest.RenameMap renameMap) {
            return DungeonCatalogProjector.renamed(renameMapPath.apply(
                    DungeonIdentityBoundaryTranslator.domainId(renameMap.mapId()),
                    renameMap.mapName()));
        }
        DungeonMapCatalogRequest.DeleteMap deleteMap = (DungeonMapCatalogRequest.DeleteMap) effectiveRequest;
        return DungeonCatalogProjector.deleted(
                deleteMapPath.apply(DungeonIdentityBoundaryTranslator.domainId(deleteMap.mapId())));
    }
}
