package src.domain.dungeon.usecase;

import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.entity.DungeonMap;
import src.domain.dungeon.repository.DungeonMapRepository;

/**
 * Creates an empty authored dungeon map aggregate.
 */
public final class CreateDungeonMapUseCase {

    private final DungeonMapRepository repository;

    public CreateDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public CreateDungeonMapResult execute(CreateDungeonMapCommand command) {
        DungeonMapId mapId = repository.nextId();
        DungeonMap dungeonMap = DungeonMap.empty(mapId, normalizeName(command));
        repository.save(dungeonMap);
        return new CreateDungeonMapResult(mapId);
    }

    private String normalizeName(CreateDungeonMapCommand command) {
        if (command == null || command.mapName().isBlank()) {
            return "Dungeon Map";
        }
        return command.mapName();
    }
}
