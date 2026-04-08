package features.world.dungeon.dungeonmap.connections.input;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;

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
