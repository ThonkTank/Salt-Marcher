package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.TileShapeSpec;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record StairConnectionCarrier(
        CellCoord anchorCell,
        int anchorLevelZ,
        TileShapeSpec shapeSpec,
        int minLevelZ,
        int maxLevelZ,
        DungeonStair stair
) implements ConnectionCarrier {

    public StairConnectionCarrier {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        shapeSpec = shapeSpec == null
                ? TileShapeSpec.defaultSpec()
                : new TileShapeSpec(
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
