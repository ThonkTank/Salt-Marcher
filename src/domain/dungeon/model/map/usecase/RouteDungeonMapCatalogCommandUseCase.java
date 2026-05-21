package src.domain.dungeon.model.map.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class RouteDungeonMapCatalogCommandUseCase {

    private static final String SEARCH = "search";
    private static final String CREATE = "create";
    private static final String RENAME = "rename";
    private static final String DELETE = "delete";

    private final ApplyDungeonMapCatalogUseCase catalogUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public RouteDungeonMapCatalogCommandUseCase(
            ApplyDungeonMapCatalogUseCase catalogUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.catalogUseCase = Objects.requireNonNull(catalogUseCase, "catalogUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(String actionKey, String query, long mapIdValue, String mapName) {
        if (SEARCH.equals(actionKey)) {
            publishedStateRepository.publishSearch(catalogPublication(catalogUseCase.search(query)));
            return;
        }
        if (CREATE.equals(actionKey)) {
            publishedStateRepository.publishCreated(mapMutation(catalogUseCase.createMap(mapName)));
            return;
        }
        if (RENAME.equals(actionKey)) {
            publishedStateRepository.publishRenamed(mapMutation(catalogUseCase.renameMap(
                    new DungeonMapIdentity(mapIdValue),
                    mapName)));
            return;
        }
        if (DELETE.equals(actionKey)) {
            publishedStateRepository.publishDeleted(mapMutation(catalogUseCase.deleteMap(
                    new DungeonMapIdentity(mapIdValue))));
        }
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutation(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }

    private static DungeonAuthoredPublishedStateRepository.CatalogPublication catalogPublication(
            ApplyDungeonMapCatalogUseCase.MapCatalogResult catalog
    ) {
        if (catalog == null) {
            return new DungeonAuthoredPublishedStateRepository.CatalogPublication(List.of());
        }
        List<DungeonAuthoredPublishedStateRepository.MapSummaryPublication> maps = new ArrayList<>();
        for (SearchDungeonMapsUseCase.MapSummary map : catalog.maps()) {
            maps.add(new DungeonAuthoredPublishedStateRepository.MapSummaryPublication(
                    map.mapId(),
                    map.mapName(),
                    map.revision()));
        }
        return new DungeonAuthoredPublishedStateRepository.CatalogPublication(maps);
    }
}
