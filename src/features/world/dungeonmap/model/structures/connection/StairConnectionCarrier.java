package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
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
        List<CubePoint> path,
        Set<Integer> stopLevels
) implements ConnectionCarrier {

    public StairConnectionCarrier {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        shape = shape == null ? StairShape.LADDER : shape;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        path = path == null ? List.of() : List.copyOf(path.stream().filter(Objects::nonNull).toList());
        stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
        if (path.isEmpty()) {
            throw new IllegalArgumentException("Transition stair path fehlt");
        }
    }

    public Set<CubePoint> pathPositions() {
        return Set.copyOf(new LinkedHashSet<>(path));
    }
}
