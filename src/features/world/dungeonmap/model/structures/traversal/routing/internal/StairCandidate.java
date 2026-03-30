package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.model.structures.traversal.TraversalStairPlacement;

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

    TraversalStairPlacement toPlacement() {
        return new TraversalStairPlacement(
                DungeonStair.planned(
                        anchor,
                        shape,
                        direction,
                        dimension1,
                        dimension2,
                        exitLevels),
                footprint);
    }

    int stairPathLength() {
        return exitLevels.size();
    }

    int profileSize() {
        LinkedHashSet<Point2i> projectedFootprint = new LinkedHashSet<>();
        for (CubePoint cell : footprint) {
            if (cell != null) {
                projectedFootprint.add(cell.projectedCell());
            }
        }
        return projectedFootprint.size();
    }

    int profileArea() {
        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (CubePoint cell : footprint) {
            if (cell == null) {
                continue;
            }
            minX = Math.min(minX, cell.x());
            minY = Math.min(minY, cell.y());
            maxX = Math.max(maxX, cell.x());
            maxY = Math.max(maxY, cell.y());
        }
        if (minX == Integer.MAX_VALUE) {
            return 0;
        }
        return (maxX - minX + 1) * (maxY - minY + 1);
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
