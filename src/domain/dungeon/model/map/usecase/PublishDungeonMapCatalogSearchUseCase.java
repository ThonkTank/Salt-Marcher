package src.domain.dungeon.model.map.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonMapCatalogSearchUseCase {

    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonMapCatalogSearchUseCase(
            SearchDungeonMapsUseCase searchDungeonMapsUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.searchDungeonMapsUseCase = Objects.requireNonNull(searchDungeonMapsUseCase, "searchDungeonMapsUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(String query) {
        publishedStateRepository.publishSearch(catalogPublication(searchDungeonMapsUseCase.execute(query)));
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
