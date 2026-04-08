package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record PreviewRemovedCorridorRequest(
        DungeonMap map,
        Long corridorId
) {
    public PreviewRemovedCorridorRequest {
        map = Objects.requireNonNull(map, "map");
    }
}
