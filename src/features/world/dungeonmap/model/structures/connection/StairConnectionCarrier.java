package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record StairConnectionCarrier(
        CellCoord anchorCell,
        int anchorLevelZ,
        StairShape shape,
        CardinalDirection direction,
        int minLevelZ,
        int maxLevelZ,
        int dimension1,
        int dimension2,
        DungeonStair stair
) implements ConnectionCarrier {

    public StairConnectionCarrier {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        shape = shape == null ? StairShape.LADDER : shape;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        stair = Objects.requireNonNull(stair, "stair");
        if (stair.path().isEmpty()) {
            throw new IllegalArgumentException("Transition stair path fehlt");
        }
    }

    public List<CubePoint> path() {
        return stair.path();
    }

    public Set<Integer> stopLevels() {
        return stair.stopLevels();
    }

    public Set<CubePoint> pathPositions() {
        return Set.copyOf(new LinkedHashSet<>(stair.occupiedPositions()));
    }
}
