package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;

import java.util.Objects;

/**
 * Map-owned request for resolving a corridor from authored input.
 */
public record CorridorResolutionRequest(
        CorridorInput input
) {
    public CorridorResolutionRequest {
        input = Objects.requireNonNull(input, "input");
    }
}
