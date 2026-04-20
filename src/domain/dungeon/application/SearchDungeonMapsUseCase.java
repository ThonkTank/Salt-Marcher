package src.domain.dungeon.application;

import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.map.repository.DungeonDocumentRepository;
import src.domain.dungeon.map.repository.DungeonMapRepository;

import java.util.Comparator;
import java.util.List;

/**
 * Searches authored dungeon map metadata.
 */
public final class SearchDungeonMapsUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public SearchDungeonMapsUseCase(DungeonMapRepository repository, DungeonDocumentRepository documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public List<DungeonMapSummary> execute(SearchMapsQuery query) {
        String searchTerm = query == null ? "" : query.query();
        return repository.searchByName(searchTerm).stream()
                .map(map -> new DungeonMapSummary(
                        mapper.toPublishedId(map.metadata().mapId()),
                        map.metadata().mapName(),
                        documentStore.revisionFor(map.metadata().mapId(), map.revision())))
                .sorted(Comparator.comparing(DungeonMapSummary::mapName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
