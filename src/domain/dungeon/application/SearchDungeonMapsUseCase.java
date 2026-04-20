package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.map.DungeonMapRepository;

import java.util.Comparator;
import java.util.List;

/**
 * Searches authored dungeon map metadata.
 */
final class SearchDungeonMapsUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;

    SearchDungeonMapsUseCase(DungeonMapRepository repository, DungeonDocumentStore documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    List<DungeonMapSummary> execute(SearchMapsQuery query) {
        String searchTerm = query == null ? "" : query.query();
        return repository.searchByName(searchTerm).stream()
                .map(map -> new DungeonMapSummary(
                        map.metadata().mapId(),
                        map.metadata().mapName(),
                        documentStore.revisionFor(map.metadata().mapId(), map.revision())))
                .sorted(Comparator.comparing(DungeonMapSummary::mapName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
