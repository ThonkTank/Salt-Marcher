package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

import java.util.Comparator;
import java.util.List;

/**
 * Searches authored dungeon map metadata.
 */
public final class SearchDungeonMapsUseCase {

    public record MapSummary(
            DungeonMapIdentity mapId,
            String mapName,
            long revision
    ) {
    }

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;

    public SearchDungeonMapsUseCase(DungeonMapRepository repository, DungeonDocumentRepository documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public List<MapSummary> execute(String searchTerm) {
        String effectiveSearchTerm = searchTerm == null ? "" : searchTerm;
        return repository.searchByName(effectiveSearchTerm).stream()
                .map(map -> new MapSummary(
                        map.metadata().mapId(),
                        map.metadata().mapName(),
                        documentStore.revisionFor(map.metadata().mapId(), map.revision())))
                .sorted(Comparator.comparing(MapSummary::mapName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
