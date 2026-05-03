package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.service.DungeonDerivedStateProjector;
import src.domain.dungeon.map.value.DungeonDerivedState;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private final DungeonDerivedStateProjector projector = new DungeonDerivedStateProjector();

    public DungeonDerivedState execute(DungeonMap dungeonMap) {
        return projector.project(dungeonMap);
    }
}
