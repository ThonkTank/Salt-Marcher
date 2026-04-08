package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.structures.stair.DungeonStair;

import java.util.Objects;

public record PreviewReplacedStairRequest(
        DungeonMap map,
        DungeonStair stair
) {
    public PreviewReplacedStairRequest {
        map = Objects.requireNonNull(map, "map");
        stair = Objects.requireNonNull(stair, "stair");
    }
}
