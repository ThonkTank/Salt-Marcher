package src.domain.dungeon.application;

import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapAuthoring;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;

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

    private final DungeonMapRepository repository;

    public RenameDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public RenamedMap execute(DungeonMapIdentity mapIdentity, String requestedMapName) {
        DungeonMap dungeonMap = repository.findById(mapIdentity)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value()));
        DungeonMap renamed = repository.save(DungeonMapAuthoring.rename(dungeonMap, normalizeName(requestedMapName)));
        return new RenamedMap(renamed.metadata().mapId());
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
