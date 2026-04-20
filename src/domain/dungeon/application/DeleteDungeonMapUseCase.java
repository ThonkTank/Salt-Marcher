package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;

    public DeleteDungeonMapUseCase(DungeonMapRepository repository, DungeonDocumentRepository documentStore) {
        this.repository = repository;
        this.documentStore = documentStore;
    }

    public DungeonMapIdentity execute(DungeonMapIdentity mapIdentity) {
        repository.delete(mapIdentity);
        documentStore.deleteMap(mapIdentity);
        return mapIdentity;
    }
}
