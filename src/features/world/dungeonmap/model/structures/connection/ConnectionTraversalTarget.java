package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;

import java.util.Objects;

public record ConnectionTraversalTarget(
        GridPoint cell,
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
