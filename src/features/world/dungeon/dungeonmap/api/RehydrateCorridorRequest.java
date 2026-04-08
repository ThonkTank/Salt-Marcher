package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.structure.model.Structure;

import java.util.Objects;

public record RehydrateCorridorRequest(
        DungeonMap map,
        CorridorInput input,
        Structure structure
) {
    public RehydrateCorridorRequest {
        map = Objects.requireNonNull(map, "map");
        input = Objects.requireNonNull(input, "input");
        structure = Objects.requireNonNull(structure, "structure");
    }
}
