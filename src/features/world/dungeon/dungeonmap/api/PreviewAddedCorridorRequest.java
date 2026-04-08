package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record PreviewAddedCorridorRequest(
        DungeonMap map,
        Corridor corridor
) {
    public PreviewAddedCorridorRequest {
        map = Objects.requireNonNull(map, "map");
        corridor = Objects.requireNonNull(corridor, "corridor");
    }
}
