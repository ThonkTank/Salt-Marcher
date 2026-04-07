package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.structure.model.Structure;

import java.util.Objects;

/**
 * Map-owned request for rehydrating a corridor directly from persisted structure plus corridor input.
 */
public record CorridorRehydrationRequest(
        CorridorInput input,
        Structure structure
) {
    public CorridorRehydrationRequest {
        input = Objects.requireNonNull(input, "input");
        structure = Objects.requireNonNull(structure, "structure");
    }
}
