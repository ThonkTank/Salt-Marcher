package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.structures.stair.Stair;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record StairConnectionCarrier(
        GridPoint anchorCell,
        int anchorLevelZ,
        Stair stair
) implements ConnectionCarrier {

    public StairConnectionCarrier {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        stair = Objects.requireNonNull(stair, "stair");
        if (stair.path().isEmpty()) {
            throw new IllegalArgumentException("Transition stair path fehlt");
        }
    }

    public CardinalDirection direction() {
        return CardinalDirection.defaultDirection();
    }

    public List<GridPoint> path() {
        return stair.path();
    }

    public Set<Integer> stopLevels() {
        return stair.stopLevels();
    }

    public Set<GridPoint> occupiedPositions() {
        return Set.copyOf(new LinkedHashSet<>(stair.occupiedPositions()));
    }
}
