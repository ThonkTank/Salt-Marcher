package src.domain.dungeon.application;

import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.map.DungeonMapRepository;

/**
 * Deletes an authored dungeon map aggregate.
 */
final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;

    DeleteDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentStore documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    DeleteDungeonMapResult execute(DeleteDungeonMapCommand command) {
        repository.delete(command.mapId());
        documentStore.deleteMap(command.mapId());
        return new DeleteDungeonMapResult(command.mapId());
    }
}
