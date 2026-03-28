package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

record StairCandidate(
        Point2i anchor,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        List<Integer> exitLevels,
        Set<CubePoint> footprint,
        CubePoint startCell,
        CubePoint endCell,
        long costHint
) {
    StairCandidate {
        Objects.requireNonNull(anchor, "anchor");
        Objects.requireNonNull(shape, "shape");
        Objects.requireNonNull(direction, "direction");
        Objects.requireNonNull(startCell, "startCell");
        Objects.requireNonNull(endCell, "endCell");
        exitLevels = normalizeExitLevels(exitLevels);
        footprint = normalizeFootprint(footprint);
        if (costHint < 0L) {
            throw new IllegalArgumentException("costHint must not be negative");
        }
        if (exitLevels.size() < 2) {
            throw new IllegalArgumentException("stair candidate requires at least two exit levels");
        }
        if (!footprint.contains(startCell) || !footprint.contains(endCell)) {
            throw new IllegalArgumentException("stair candidate endpoints must be part of the footprint");
        }
    }

    StairPlacement toPlacement() {
        return new StairPlacement(
                anchor,
                shape,
                direction,
                dimension1,
                dimension2,
                exitLevels,
                footprint);
    }

    private static List<Integer> normalizeExitLevels(List<Integer> exitLevels) {
        if (exitLevels == null || exitLevels.isEmpty()) {
            return List.of();
        }
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer exitLevel : exitLevels) {
            if (exitLevel != null) {
                result.add(exitLevel);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<CubePoint> normalizeFootprint(Set<CubePoint> footprint) {
        if (footprint == null || footprint.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint cell : footprint) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
