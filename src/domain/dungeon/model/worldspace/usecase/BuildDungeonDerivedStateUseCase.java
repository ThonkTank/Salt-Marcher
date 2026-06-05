package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonDerivedStateProjection;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private final DungeonDerivedStateProjection projector = new DungeonDerivedStateProjection();

    public DungeonDerivedState execute(DungeonMap dungeonMap) {
        return projector.project(dungeonMap);
    }
}
