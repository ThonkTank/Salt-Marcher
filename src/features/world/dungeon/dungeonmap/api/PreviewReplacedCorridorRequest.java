package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record PreviewReplacedCorridorRequest(
        DungeonMap map,
        Corridor corridor
) {
    public PreviewReplacedCorridorRequest {
        map = Objects.requireNonNull(map, "map");
        corridor = Objects.requireNonNull(corridor, "corridor");
    }
}
