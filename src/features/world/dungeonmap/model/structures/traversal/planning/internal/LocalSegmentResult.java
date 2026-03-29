package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

record LocalSegmentResult(
        List<CubePoint> pathCells,
        CubePoint sourceCell,
        CubePoint targetCell
) {
    LocalSegmentResult {
        pathCells = pathCells == null ? List.of() : List.copyOf(pathCells);
    }

    static LocalSegmentResult unroutable() {
        return new LocalSegmentResult(List.of(), null, null);
    }

    boolean routable() {
        return sourceCell != null && targetCell != null && !pathCells.isEmpty();
    }

    Set<CubePoint> corridorCells() {
        if (pathCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint pathCell : pathCells) {
            if (pathCell != null) {
                result.add(pathCell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
