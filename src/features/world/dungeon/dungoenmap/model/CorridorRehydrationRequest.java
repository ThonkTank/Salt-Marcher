package features.world.dungeon.dungoenmap.model;

import features.world.dungeon.dungoenmap.corridor.model.CorridorPathTrace;
import features.world.dungeon.dungoenmap.corridor.model.CorridorSpecification;
import features.world.dungeon.dungoenmap.structure.model.Structure;

import java.util.List;
import java.util.Objects;

/**
 * Map-owned request for rehydrating a corridor from persisted structure and routed traces.
 */
public record CorridorRehydrationRequest(
        CorridorSpecification specification,
        Structure structure,
        List<CorridorPathTrace> pathTraces
) {
    public CorridorRehydrationRequest {
        specification = Objects.requireNonNull(specification, "specification");
        structure = Objects.requireNonNull(structure, "structure");
        pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
    }
}
