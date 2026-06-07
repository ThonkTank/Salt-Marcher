package src.domain.dungeon.model.core.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;

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
        Optional<DungeonMap> foundMap = repository.findById(mapIdentity);
        if (foundMap.isEmpty()) {
            throw new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value());
        }
        DungeonMap dungeonMap = foundMap.get();
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
