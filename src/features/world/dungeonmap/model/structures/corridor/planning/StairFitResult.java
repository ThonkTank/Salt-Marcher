package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.List;
import java.util.Set;

record StairFitResult(
        Point2i anchor,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        List<Integer> exitLevels,
        Set<CubePoint> corridorCellsToRemove,
        Set<CubePoint> corridorCellsToAdd
) {
    StairFitResult {
        exitLevels = exitLevels == null ? List.of() : List.copyOf(exitLevels);
        corridorCellsToRemove = corridorCellsToRemove == null ? Set.of() : Set.copyOf(corridorCellsToRemove);
        corridorCellsToAdd = corridorCellsToAdd == null ? Set.of() : Set.copyOf(corridorCellsToAdd);
    }
}
