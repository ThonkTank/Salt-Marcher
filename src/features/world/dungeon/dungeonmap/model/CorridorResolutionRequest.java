package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.CorridorSpecification;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;

import java.util.List;
import java.util.Objects;

/**
 * Map-owned request for resolving a corridor from authored corridor state plus current corridor doors.
 */
public record CorridorResolutionRequest(
        CorridorSpecification specification,
        List<Door> corridorDoors
) {
    public CorridorResolutionRequest {
        specification = Objects.requireNonNull(specification, "specification");
        corridorDoors = corridorDoors == null ? List.of() : List.copyOf(corridorDoors);
    }
}
