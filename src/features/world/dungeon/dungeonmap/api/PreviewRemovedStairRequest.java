package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record PreviewRemovedStairRequest(
        DungeonMap map,
        Long stairId
) {
    public PreviewRemovedStairRequest {
        map = Objects.requireNonNull(map, "map");
    }
}
