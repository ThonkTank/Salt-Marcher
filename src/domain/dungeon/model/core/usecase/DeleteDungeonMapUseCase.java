package src.domain.dungeon.model.core.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;

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
