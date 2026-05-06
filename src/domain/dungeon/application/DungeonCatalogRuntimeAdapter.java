package src.domain.dungeon.application;

import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
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

    public DungeonMapCatalogResponse handle(@Nullable DungeonMapCatalogCommand command) {
        DungeonMapCatalogCommand effectiveCommand = command == null
                ? new DungeonMapCatalogCommand.Search("")
                : command;
        if (effectiveCommand instanceof DungeonMapCatalogCommand.Search search) {
            return DungeonCatalogProjector.mapList(searchMapsPath.apply(search.query()));
        }
        if (effectiveCommand instanceof DungeonMapCatalogCommand.CreateMap createMap) {
            return DungeonCatalogProjector.created(createMapPath.apply(createMap.mapName()));
        }
        if (effectiveCommand instanceof DungeonMapCatalogCommand.RenameMap renameMap) {
            return DungeonCatalogProjector.renamed(renameMapPath.apply(
                    DungeonIdentityBoundaryTranslator.domainId(renameMap.mapId()),
                    renameMap.mapName()));
        }
        DungeonMapCatalogCommand.DeleteMap deleteMap = (DungeonMapCatalogCommand.DeleteMap) effectiveCommand;
        return DungeonCatalogProjector.deleted(
                deleteMapPath.apply(DungeonIdentityBoundaryTranslator.domainId(deleteMap.mapId())));
    }
}
