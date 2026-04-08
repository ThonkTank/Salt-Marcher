package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.geometry.GridPoint;

import java.util.Objects;

public record CorridorBoundaryDescription(
        Corridor corridor,
        GridPoint corridorCell
) {
    public CorridorBoundaryDescription {
        corridor = Objects.requireNonNull(corridor, "corridor");
        corridorCell = Objects.requireNonNull(corridorCell, "corridorCell");
    }
}
