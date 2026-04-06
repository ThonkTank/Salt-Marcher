package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.TilePath;
import features.world.dungeonmap.model.geometry.TileShapeSpec;
import features.world.dungeonmap.model.objects.StructureObject;

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
        StructureObject structure
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
        structure = structure == null ? StructureObject.empty() : structure;
        var stair = structure.stair();
        if (stair == null || stair.path().isEmpty()) {
            throw new IllegalArgumentException("Transition stair path fehlt");
        }
    }

    public CardinalDirection direction() {
        return shapeSpec.direction();
    }

    public List<CubePoint> path() {
        var stair = structure.stair();
        return stair.path();
    }

    public TilePath tilePath() {
        var stair = structure.stair();
        return stair.tilePath();
    }

    public Set<Integer> stopLevels() {
        var stair = structure.stair();
        return stair.stopLevels();
    }

    public Set<CubePoint> pathPositions() {
        var stair = structure.stair();
        return Set.copyOf(new LinkedHashSet<>(stair.occupiedPositions()));
    }
}
