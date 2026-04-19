package src.domain.dungeon.application;

import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.map.DungeonMap;
import src.domain.dungeon.map.DungeonMapRepository;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;

    public CreateDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentStore documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public CreateDungeonMapResult execute(CreateDungeonMapCommand command) {
        DungeonMapId mapId = repository.nextId();
        String mapName = normalizeName(command);
        DungeonMap dungeonMap = DungeonMap.empty(mapId, mapName);
        repository.save(dungeonMap);
        documentStore.ensureMap(mapId, mapName);
        return new CreateDungeonMapResult(mapId);
    }

    private String normalizeName(CreateDungeonMapCommand command) {
        if (command == null || command.mapName().isBlank()) {
            return "Dungeon Map";
        }
        return command.mapName();
    }
}
