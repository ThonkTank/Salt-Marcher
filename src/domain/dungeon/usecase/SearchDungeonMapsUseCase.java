package src.domain.dungeon.usecase;

import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.SearchMapsQuery;
import src.domain.dungeon.repository.DungeonMapRepository;

import java.util.Comparator;
import java.util.List;

/**
 * Searches authored dungeon map metadata.
 */
public final class SearchDungeonMapsUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;

    public SearchDungeonMapsUseCase(DungeonMapRepository repository, DungeonDocumentStore documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public List<DungeonMapSummary> execute(SearchMapsQuery query) {
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
