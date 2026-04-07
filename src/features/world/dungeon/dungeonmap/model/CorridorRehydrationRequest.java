package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.CorridorSpecification;
import features.world.dungeon.dungeonmap.structure.model.Structure;

import java.util.Objects;

/**
 * Map-owned request for rehydrating a corridor directly from persisted structure plus corridor metadata.
 */
public record CorridorRehydrationRequest(
        CorridorSpecification specification,
        Structure structure
) {
    public CorridorRehydrationRequest {
        specification = Objects.requireNonNull(specification, "specification");
        structure = Objects.requireNonNull(structure, "structure");
    }
}
