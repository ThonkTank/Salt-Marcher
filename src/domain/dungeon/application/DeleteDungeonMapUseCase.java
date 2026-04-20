package src.domain.dungeon.application;

import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.map.repository.DungeonDocumentRepository;
import src.domain.dungeon.map.repository.DungeonMapRepository;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public DeleteDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentRepository documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public DeleteDungeonMapResult execute(DeleteDungeonMapCommand command) {
        var mapIdentity = mapper.toDomainIdentity(command.mapId());
        repository.delete(mapIdentity);
        documentStore.deleteMap(mapIdentity);
        return new DeleteDungeonMapResult(command.mapId());
    }
}
