package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapAuthoring;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    public static final class CreatedMap {
        private final DungeonMapIdentity mapId;

        public CreatedMap(DungeonMapIdentity mapId) {
            this.mapId = mapId;
        }

        public DungeonMapIdentity mapId() {
            return mapId;
        }
    }

    private final DungeonMapRepository repository;

    public CreateDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public CreatedMap execute(String requestedMapName) {
        DungeonMapIdentity mapIdentity = repository.nextMapId();
        String mapName = normalizeName(requestedMapName);
        DungeonMap dungeonMap = DungeonMapAuthoring.empty(mapIdentity, mapName);
        DungeonMap saved = repository.save(dungeonMap);
        return new CreatedMap(saved.metadata().mapId());
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
