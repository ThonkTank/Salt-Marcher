package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.structures.transition.DungeonTransition;

import java.util.Objects;

public record PreviewReplacedTransitionRequest(
        DungeonMap map,
        DungeonTransition transition
) {
    public PreviewReplacedTransitionRequest {
        map = Objects.requireNonNull(map, "map");
        transition = Objects.requireNonNull(transition, "transition");
    }
}
