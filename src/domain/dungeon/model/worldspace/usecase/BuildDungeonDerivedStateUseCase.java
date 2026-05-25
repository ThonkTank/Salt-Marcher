package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonDerivedStateProjection;
import src.domain.dungeon.model.worldspace.model.DungeonDerivedState;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private final DungeonDerivedStateProjection projector = new DungeonDerivedStateProjection();

    public DungeonDerivedState execute(DungeonMap dungeonMap) {
        return projector.project(dungeonMap);
    }
}
