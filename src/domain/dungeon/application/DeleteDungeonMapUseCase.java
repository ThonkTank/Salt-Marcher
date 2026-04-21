package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;

    public DeleteDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public DungeonMapIdentity execute(DungeonMapIdentity mapIdentity) {
        repository.delete(mapIdentity);
        return mapIdentity;
    }
}
