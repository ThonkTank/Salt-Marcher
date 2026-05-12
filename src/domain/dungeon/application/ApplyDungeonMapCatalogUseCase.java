package src.domain.dungeon.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;

public final class ApplyDungeonMapCatalogUseCase {

    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;

    public ApplyDungeonMapCatalogUseCase(
            SearchDungeonMapsUseCase searchDungeonMapsUseCase,
            CreateDungeonMapUseCase createDungeonMapUseCase,
            RenameDungeonMapUseCase renameDungeonMapUseCase,
            DeleteDungeonMapUseCase deleteDungeonMapUseCase,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        this.searchDungeonMapsUseCase = Objects.requireNonNull(searchDungeonMapsUseCase, "searchDungeonMapsUseCase");
        this.createDungeonMapUseCase = Objects.requireNonNull(createDungeonMapUseCase, "createDungeonMapUseCase");
        this.renameDungeonMapUseCase = Objects.requireNonNull(renameDungeonMapUseCase, "renameDungeonMapUseCase");
        this.deleteDungeonMapUseCase = Objects.requireNonNull(deleteDungeonMapUseCase, "deleteDungeonMapUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void search(String query) {
        publishedStateRepository.publishMapCatalog(searchDungeonMapsUseCase.execute(query));
    }

    public void createMap(String mapName) {
        publishedStateRepository.publishMapCatalogMutation(
                DungeonPublishedStateRepository.CatalogMutationKind.CREATED,
                createDungeonMapUseCase.execute(mapName).mapId());
    }

    public void renameMap(@Nullable DungeonMapIdentity mapId, String mapName) {
        publishedStateRepository.publishMapCatalogMutation(
                DungeonPublishedStateRepository.CatalogMutationKind.RENAMED,
                renameDungeonMapUseCase.execute(effectiveId(mapId), mapName).mapId());
    }

    public void deleteMap(@Nullable DungeonMapIdentity mapId) {
        publishedStateRepository.publishMapCatalogMutation(
                DungeonPublishedStateRepository.CatalogMutationKind.DELETED,
                deleteDungeonMapUseCase.execute(effectiveId(mapId)));
    }

    private static DungeonMapIdentity effectiveId(@Nullable DungeonMapIdentity mapId) {
        return mapId == null ? new DungeonMapIdentity(1L) : mapId;
    }
}
