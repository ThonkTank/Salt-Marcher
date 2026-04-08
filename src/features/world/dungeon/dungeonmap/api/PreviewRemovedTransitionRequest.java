package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record PreviewRemovedTransitionRequest(
        DungeonMap map,
        Long transitionId
) {
    public PreviewRemovedTransitionRequest {
        map = Objects.requireNonNull(map, "map");
    }
}
