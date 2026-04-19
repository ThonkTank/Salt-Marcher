package src.domain.dungeon.application;

import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DeleteDungeonMapResult;
import src.domain.dungeon.map.DungeonMapRepository;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;

    public DeleteDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentStore documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public DeleteDungeonMapResult execute(DeleteDungeonMapCommand command) {
        repository.delete(command.mapId());
        documentStore.deleteMap(command.mapId());
        return new DeleteDungeonMapResult(command.mapId());
    }
}
