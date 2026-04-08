package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record ResolveCorridorRequest(
        DungeonMap map,
        CorridorInput input
) {
    public ResolveCorridorRequest {
        map = Objects.requireNonNull(map, "map");
        input = Objects.requireNonNull(input, "input");
    }
}
