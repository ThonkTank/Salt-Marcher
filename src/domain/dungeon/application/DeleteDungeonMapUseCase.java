package src.domain.dungeon.application;

import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

/**
 * Deletes an authored dungeon map aggregate.
 */
public final class DeleteDungeonMapUseCase {

    private final Consumer<DungeonMapIdentity> deleteMap;

    public DeleteDungeonMapUseCase(Consumer<DungeonMapIdentity> deleteMap) {
        this.deleteMap = Objects.requireNonNull(deleteMap, "deleteMap");
    }

    public DungeonMapIdentity execute(DungeonMapIdentity mapIdentity) {
        deleteMap.accept(mapIdentity);
        return mapIdentity;
    }
}
