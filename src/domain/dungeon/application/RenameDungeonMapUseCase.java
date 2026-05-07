package src.domain.dungeon.application;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Renames one authored dungeon map aggregate.
 */
public final class RenameDungeonMapUseCase {

    public static final class RenamedMap {
        private final DungeonMapIdentity mapId;

        public RenamedMap(DungeonMapIdentity mapId) {
            this.mapId = mapId;
        }

        public DungeonMapIdentity mapId() {
            return mapId;
        }
    }

    private final Function<DungeonMapIdentity, Optional<DungeonMap>> findById;
    private final Function<DungeonMap, DungeonMap> saveMap;

    public RenameDungeonMapUseCase(
            Function<DungeonMapIdentity, Optional<DungeonMap>> findById,
            Function<DungeonMap, DungeonMap> saveMap
    ) {
        this.findById = Objects.requireNonNull(findById, "findById");
        this.saveMap = Objects.requireNonNull(saveMap, "saveMap");
    }

    public RenamedMap execute(DungeonMapIdentity mapIdentity, String requestedMapName) {
        DungeonMap dungeonMap = findById.apply(mapIdentity)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value()));
        DungeonMap renamed = saveMap.apply(dungeonMap.rename(normalizeName(requestedMapName)));
        return new RenamedMap(renamed.metadata().mapId());
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
