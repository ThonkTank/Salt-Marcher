package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonDerivedStateProjection;
import src.domain.dungeon.model.map.model.DungeonDerivedState;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private final DungeonDerivedStateProjection projector = new DungeonDerivedStateProjection();

    public DungeonDerivedState execute(DungeonMap dungeonMap) {
        return projector.project(dungeonMap);
    }
}
