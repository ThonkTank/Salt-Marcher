package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;

import java.util.List;
import java.util.Objects;

/**
 * Map-owned request for materializing corridor-external resolution context.
 */
public record CorridorResolutionContextRequest(
        int levelZ,
        List<Door> corridorDoors
) {
    public CorridorResolutionContextRequest {
        corridorDoors = corridorDoors == null ? List.of() : List.copyOf(corridorDoors);
    }

    public static CorridorResolutionContextRequest forCorridor(Corridor corridor) {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        int levelZ = resolvedCorridor.levelZ();
        return new CorridorResolutionContextRequest(
                levelZ,
                resolvedCorridor.boundaryAtLevel(levelZ).doors());
    }
}
