package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    public record CreatedMap(DungeonMapIdentity mapId) {
    }

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;

    public CreateDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentRepository documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public CreatedMap execute(String requestedMapName) {
        DungeonMapIdentity mapIdentity = repository.nextId();
        String mapName = normalizeName(requestedMapName);
        DungeonMap dungeonMap = DungeonMap.empty(mapIdentity, mapName);
        repository.save(dungeonMap);
        documentStore.ensureMap(mapIdentity, mapName);
        return new CreatedMap(mapIdentity);
    }

    private String normalizeName(String requestedMapName) {
        if (requestedMapName == null || requestedMapName.isBlank()) {
            return "Dungeon Map";
        }
        return requestedMapName;
    }
}
