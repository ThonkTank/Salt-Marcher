package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonMapIdentity;

import java.util.Comparator;
import java.util.List;

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

    private final DungeonMapSearch search;

    public SearchDungeonMapsUseCase(DungeonMapSearch search) {
        this.search = search;
    }

    public List<MapSummary> execute(String searchTerm) {
        String effectiveSearchTerm = searchTerm == null ? "" : searchTerm;
        return search.searchByName(effectiveSearchTerm).stream()
                .map(map -> new MapSummary(
                        map.metadata().mapId(),
                        map.metadata().mapName(),
                        map.revision()))
                .sorted(Comparator.comparing(MapSummary::mapName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
