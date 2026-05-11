package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.RenameDungeonMapUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;

/**
 * Public authored-dungeon backend boundary for map catalog work.
 */
public final class DungeonCatalogApplicationService {

    private final DungeonPublishedStatePublisher publishedStatePublisher;
    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;

    public DungeonCatalogApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapSearch mapSearch,
            DungeonPublishedStatePublisher publishedStatePublisher
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        DungeonMapSearch search = Objects.requireNonNull(mapSearch, "mapSearch");
        this.publishedStatePublisher = Objects.requireNonNull(publishedStatePublisher, "publishedStatePublisher");
        this.searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(search);
        this.createDungeonMapUseCase = new CreateDungeonMapUseCase(repository::nextMapId, repository::save);
        this.renameDungeonMapUseCase = new RenameDungeonMapUseCase(repository::findById, repository::save);
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository::delete);
    }

    public void catalog(DungeonMapCatalogCommand command) {
        DungeonMapCatalogResponse response = catalogResponse(Objects.requireNonNull(command, "command"));
        publishedStatePublisher.publishMapCatalog(response);
    }

    private DungeonMapCatalogResponse catalogResponse(DungeonMapCatalogCommand command) {
        if (command instanceof DungeonMapCatalogCommand.Search search) {
            return new DungeonMapCatalogResponse.MapList(
                    searchDungeonMapsUseCase.execute(search.query()).stream()
                            .map(summary -> new DungeonMapSummary(id(summary.mapId()), summary.mapName(), summary.revision()))
                            .toList());
        }
        if (command instanceof DungeonMapCatalogCommand.CreateMap createMap) {
            return new DungeonMapCatalogResponse.MapMutation(
                    DungeonMapCatalogResponse.MutationKind.CREATED,
                    id(createDungeonMapUseCase.execute(createMap.mapName()).mapId()));
        }
        if (command instanceof DungeonMapCatalogCommand.RenameMap renameMap) {
            return new DungeonMapCatalogResponse.MapMutation(
                    DungeonMapCatalogResponse.MutationKind.RENAMED,
                    id(renameDungeonMapUseCase.execute(domainId(renameMap.mapId()), renameMap.mapName()).mapId()));
        }
        DungeonMapCatalogCommand.DeleteMap deleteMap = (DungeonMapCatalogCommand.DeleteMap) command;
        return new DungeonMapCatalogResponse.MapMutation(
                DungeonMapCatalogResponse.MutationKind.DELETED,
                id(deleteDungeonMapUseCase.execute(domainId(deleteMap.mapId()))));
    }

    private static DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonMapId id(@Nullable DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }
}
