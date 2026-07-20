package features.dungeon.application.authored;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;

/** Internal catalog publication facts. */
final class DungeonAuthoredPublication {

    private DungeonAuthoredPublication() {
    }

    record Catalog(List<MapSummary> maps) {
        Catalog {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }

        @Override
        public List<MapSummary> maps() {
            return List.copyOf(maps);
        }
    }

    record MapMutation(DungeonMapIdentity mapId) {
    }

    record MapSummary(DungeonMapIdentity mapId, String mapName, long revision) {
        MapSummary {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        }
    }
}
