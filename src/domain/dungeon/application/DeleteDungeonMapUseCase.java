package src.domain.dungeon.application;

import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final DungeonMapRepository repository;

    public DeleteDungeonMapUseCase(DungeonMapRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public DungeonMapIdentity execute(DungeonMapIdentity mapIdentity) {
        repository.delete(mapIdentity);
        return mapIdentity;
    }
}
