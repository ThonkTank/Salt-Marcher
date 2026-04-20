package src.domain.dungeon.application;

import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.CreateDungeonMapResult;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.repository.DungeonDocumentRepository;
import src.domain.dungeon.map.repository.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public CreateDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentRepository documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public CreateDungeonMapResult execute(CreateDungeonMapCommand command) {
        DungeonMapIdentity mapIdentity = repository.nextId();
        DungeonMapId mapId = mapper.toPublishedId(mapIdentity);
        String mapName = normalizeName(command);
        DungeonMap dungeonMap = DungeonMap.empty(mapIdentity, mapName);
        repository.save(dungeonMap);
        documentStore.ensureMap(mapIdentity, mapName);
        return new CreateDungeonMapResult(mapId);
    }

    private String normalizeName(CreateDungeonMapCommand command) {
        if (command == null || command.mapName().isBlank()) {
            return "Dungeon Map";
        }
        return command.mapName();
    }
}
