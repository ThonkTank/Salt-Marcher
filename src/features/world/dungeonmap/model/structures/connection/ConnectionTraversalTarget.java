package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

import java.util.Objects;

public record ConnectionTraversalTarget(
        CellCoord cell,
        int levelZ,
        CardinalDirection heading,
        Long transitionId
) {
    public ConnectionTraversalTarget {
        if (transitionId == null) {
            cell = Objects.requireNonNull(cell, "cell");
            heading = Objects.requireNonNull(heading, "heading");
        }
    }
}
