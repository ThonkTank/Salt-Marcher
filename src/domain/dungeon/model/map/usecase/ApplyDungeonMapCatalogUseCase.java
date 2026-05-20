package src.domain.dungeon.model.map.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.helper.DungeonMapCatalogPublishedProjectionHelper;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapSummary;

public final class ApplyDungeonMapCatalogUseCase {

    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;
    private final DungeonMapCatalogPublishedProjectionHelper projectionHelper =
            new DungeonMapCatalogPublishedProjectionHelper();

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
        publishedStateRepository.publishMapCatalog(catalog(searchDungeonMapsUseCase.execute(query)));
    }

    public void createMap(String mapName) {
        publishedStateRepository.publishMapCreated(createDungeonMapUseCase.execute(mapName).mapId());
    }

    public void renameMap(@Nullable DungeonMapIdentity mapId, String mapName) {
        publishedStateRepository.publishMapRenamed(
                renameDungeonMapUseCase.execute(effectiveId(mapId), mapName).mapId());
    }

    public void deleteMap(@Nullable DungeonMapIdentity mapId) {
        publishedStateRepository.publishMapDeleted(deleteDungeonMapUseCase.execute(effectiveId(mapId)));
    }

    private static DungeonMapIdentity effectiveId(@Nullable DungeonMapIdentity mapId) {
        return mapId == null ? new DungeonMapIdentity(1L) : mapId;
    }

    private DungeonMapCatalogResponse catalog(List<SearchDungeonMapsUseCase.MapSummary> maps) {
        return projectionHelper.catalog(maps.stream()
                .map(this::summary)
                .toList());
    }

    private DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary map) {
        return projectionHelper.summary(map.mapId(), map.mapName(), map.revision());
    }
}
