package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    public record CreatedMap(DungeonMapIdentity mapId) {
    }

    private final DungeonMapRepository repository;

    public CreateDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public CreatedMap execute(String requestedMapName) {
        DungeonMapIdentity mapIdentity = repository.nextMapId();
        String mapName = normalizeName(requestedMapName);
        DungeonMap dungeonMap = DungeonMap.empty(mapIdentity, mapName);
        repository.save(dungeonMap);
        return new CreatedMap(mapIdentity);
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
