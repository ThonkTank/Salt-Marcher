package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPath;
import features.world.dungeonmap.geometry.GridPathPatternSpec;
import features.world.dungeonmap.model.structures.stair.Stair;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record StairConnectionCarrier(
        GridPoint anchorCell,
        int anchorLevelZ,
        GridPathPatternSpec shapeSpec,
        int minLevelZ,
        int maxLevelZ,
        Stair stair
) implements ConnectionCarrier {

    public StairConnectionCarrier {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        shapeSpec = shapeSpec == null
                ? GridPathPatternSpec.defaultSpec()
                : new GridPathPatternSpec(
                        shapeSpec.kind(),
                        shapeSpec.direction() == null ? CardinalDirection.defaultDirection() : shapeSpec.direction(),
                        shapeSpec.parameter1(),
                        shapeSpec.parameter2());
        stair = Objects.requireNonNull(stair, "stair");
        if (stair.path().isEmpty()) {
            throw new IllegalArgumentException("Transition stair path fehlt");
        }
    }

    public CardinalDirection direction() {
        return shapeSpec.direction();
    }

    public List<GridPoint> path() {
        return stair.path();
    }

    public GridPath tilePath() {
        return stair.tilePath();
    }

    public Set<Integer> stopLevels() {
        return stair.stopLevels();
    }

    public Set<GridPoint> pathPositions() {
        return Set.copyOf(new LinkedHashSet<>(stair.occupiedPositions()));
    }
}
