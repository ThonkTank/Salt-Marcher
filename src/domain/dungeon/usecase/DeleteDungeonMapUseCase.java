package src.domain.dungeon.usecase;

import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DeleteDungeonMapResult;
import src.domain.dungeon.repository.DungeonMapRepository;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;

    public DeleteDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public DeleteDungeonMapResult execute(DeleteDungeonMapCommand command) {
        repository.delete(command.mapId());
        return new DeleteDungeonMapResult(command.mapId());
    }
}
