package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.structures.stair.DungeonStair;

import java.util.Objects;

public record PreviewAddedStairRequest(
        DungeonMap map,
        DungeonStair stair
) {
    public PreviewAddedStairRequest {
        map = Objects.requireNonNull(map, "map");
        stair = Objects.requireNonNull(stair, "stair");
    }
}
