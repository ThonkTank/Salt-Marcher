package src.domain.dungeon.model.map.usecase;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;

/**
 * Searches authored dungeon map metadata.
 */
public final class SearchDungeonMapsUseCase {

    public static final class MapSummary {
        private final DungeonMapIdentity mapId;
        private final String mapName;
        private final long revision;

        public MapSummary(
                DungeonMapIdentity mapId,
                String mapName,
                long revision
        ) {
            this.mapId = mapId;
            this.mapName = mapName;
            this.revision = revision;
        }

        public DungeonMapIdentity mapId() {
            return mapId;
        }

        public String mapName() {
            return mapName;
        }

        public long revision() {
            return revision;
        }
    }

    private final DungeonMapRepository repository;

    public SearchDungeonMapsUseCase(DungeonMapRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public List<MapSummary> execute(String searchTerm) {
        String effectiveSearchTerm = searchTerm == null ? "" : searchTerm;
        List<MapSummary> summaries = new ArrayList<>();
        for (var map : repository.searchByName(effectiveSearchTerm)) {
            summaries.add(new MapSummary(
                        map.metadata().mapId(),
                        map.metadata().mapName(),
                        map.revision()));
        }
        summaries.sort(SearchDungeonMapsUseCase::compareByMapName);
        return List.copyOf(summaries);
    }

    private static int compareByMapName(MapSummary left, MapSummary right) {
        return Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER).compare(left.mapName(), right.mapName());
    }
}
