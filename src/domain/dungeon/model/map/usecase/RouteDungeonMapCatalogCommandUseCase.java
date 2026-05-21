package src.domain.dungeon.model.map.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class RouteDungeonMapCatalogCommandUseCase {

    private static final int SEARCH_OPERATION = 1;
    private static final int CREATE_OPERATION = 2;
    private static final int RENAME_OPERATION = 3;
    private static final int DELETE_OPERATION = 4;

    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public RouteDungeonMapCatalogCommandUseCase(
            SearchDungeonMapsUseCase searchDungeonMapsUseCase,
            CreateDungeonMapUseCase createDungeonMapUseCase,
            RenameDungeonMapUseCase renameDungeonMapUseCase,
            DeleteDungeonMapUseCase deleteDungeonMapUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.searchDungeonMapsUseCase = Objects.requireNonNull(searchDungeonMapsUseCase, "searchDungeonMapsUseCase");
        this.createDungeonMapUseCase = Objects.requireNonNull(createDungeonMapUseCase, "createDungeonMapUseCase");
        this.renameDungeonMapUseCase = Objects.requireNonNull(renameDungeonMapUseCase, "renameDungeonMapUseCase");
        this.deleteDungeonMapUseCase = Objects.requireNonNull(deleteDungeonMapUseCase, "deleteDungeonMapUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            int operationKey,
            String query,
            long mapIdValue,
            String mapName
    ) {
        switch (operationKey) {
            case SEARCH_OPERATION -> publishedStateRepository.publishSearch(catalogPublication(
                    searchDungeonMapsUseCase.execute(query)));
            case CREATE_OPERATION -> publishedStateRepository.publishCreated(mapMutation(
                    createDungeonMapUseCase.execute(mapName).mapId()));
            case RENAME_OPERATION -> publishedStateRepository.publishRenamed(mapMutation(
                    renameDungeonMapUseCase.execute(
                            new DungeonMapIdentity(mapIdValue),
                            mapName)
                            .mapId()));
            case DELETE_OPERATION -> publishedStateRepository.publishDeleted(mapMutation(
                    deleteDungeonMapUseCase.execute(new DungeonMapIdentity(mapIdValue))));
            default -> throw new IllegalArgumentException("Unknown dungeon map catalog operation: " + operationKey);
        }
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutation(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }

    private static DungeonAuthoredPublishedStateRepository.CatalogPublication catalogPublication(
            List<SearchDungeonMapsUseCase.MapSummary> maps
    ) {
        List<DungeonAuthoredPublishedStateRepository.MapSummaryPublication> publications = new ArrayList<>();
        List<SearchDungeonMapsUseCase.MapSummary> safeMaps =
                maps == null ? List.<SearchDungeonMapsUseCase.MapSummary>of() : maps;
        for (SearchDungeonMapsUseCase.MapSummary map : safeMaps) {
            publications.add(new DungeonAuthoredPublishedStateRepository.MapSummaryPublication(
                    map.mapId(),
                    map.mapName(),
                    map.revision()));
        }
        return new DungeonAuthoredPublishedStateRepository.CatalogPublication(publications);
    }
}
