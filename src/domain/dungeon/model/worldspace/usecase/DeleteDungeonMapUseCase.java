package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;

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
