package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;

public sealed interface CellStructure permits CellStructure.RoomStructure, CellStructure.CorridorStructure, CellStructure.StairStructure, CellStructure.TransitionStructure {
    record RoomStructure(Long clusterId, Long roomId) implements CellStructure {
    }

    record CorridorStructure(Corridor corridor) implements CellStructure {
    }

    record StairStructure(DungeonStair stair) implements CellStructure {
    }

    record TransitionStructure(DungeonTransition transition) implements CellStructure {
    }
}
