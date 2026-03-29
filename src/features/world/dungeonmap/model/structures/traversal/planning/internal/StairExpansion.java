package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.List;

final class StairExpansion {

    private StairExpansion() {
        throw new AssertionError("No instances");
    }

    static List<StairNeighbor> expand(CubePoint cell, SearchVolume volume) {
        if (cell == null || volume == null) {
            return List.of();
        }
        List<StairNeighbor> results = new ArrayList<>();
        for (CardinalDirection direction : CardinalDirection.values()) {
            expandDirected(cell, direction, true, volume, results);
            expandDirected(cell, direction, false, volume, results);
        }
        return List.copyOf(results);
    }

    private static void expandDirected(
            CubePoint cell,
            CardinalDirection direction,
            boolean ascending,
            SearchVolume volume,
            List<StairNeighbor> results
    ) {
        int maxDelta = ascending
                ? volume.maxZ() - cell.z()
                : cell.z() - volume.minZ();
        if (maxDelta < 1) {
            return;
        }
        for (int delta = 1; delta <= maxDelta; delta++) {
            int minZ = ascending ? cell.z() : cell.z() - delta;
            int maxZ = ascending ? cell.z() + delta : cell.z();
            for (AutomaticStairVariantCatalog.StairVariant variant
                    : AutomaticStairVariantCatalog.variantsFor(direction, minZ, maxZ)) {
                Point2i anchor = resolveAnchor(cell, variant, ascending);
                List<CubePoint> path = variant.placeAt(anchor);
                if (path.isEmpty()
                        || !containsTraversalEndpoint(path, cell, ascending)
                        || !volume.isFootprintPassable(path)) {
                    continue;
                }
                CubePoint exitCell = ascending ? path.getLast() : path.getFirst();
                List<CubePoint> traversalPath = traversalPath(path, ascending);
                results.add(new StairNeighbor(
                        exitCell,
                        path,
                        variant.shape(),
                        variant.direction(),
                        variant.dimension1(),
                        variant.dimension2(),
                        minZ,
                        maxZ,
                        firstHorizontalDirectionIndex(traversalPath),
                        lastHorizontalDirectionIndex(traversalPath),
                        stairTraversalCost(variant.stairPathLength())));
            }
        }
    }

    private static Point2i resolveAnchor(
            CubePoint cell,
            AutomaticStairVariantCatalog.StairVariant variant,
            boolean ascending
    ) {
        if (cell == null || variant == null) {
            return null;
        }
        return ascending
                ? variant.placementAnchorForLowerTerminal(cell.projectedCell())
                : variant.placementAnchorForUpperTerminal(cell.projectedCell());
    }

    private static boolean containsTraversalEndpoint(List<CubePoint> path, CubePoint cell, boolean ascending) {
        if (path == null || path.isEmpty() || cell == null) {
            return false;
        }
        return ascending ? cell.equals(path.getFirst()) : cell.equals(path.getLast());
    }

    private static int stairTraversalCost(int stairPathLength) {
        long penalizedCost = TraversalPlanningCostModel.penalizeStairs(stairPathLength, 1);
        return penalizedCost >= Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) penalizedCost;
    }

    private static List<CubePoint> traversalPath(List<CubePoint> path, boolean ascending) {
        if (path == null || path.isEmpty() || ascending) {
            return path == null ? List.of() : List.copyOf(path);
        }
        ArrayList<CubePoint> reversed = new ArrayList<>(path);
        java.util.Collections.reverse(reversed);
        return List.copyOf(reversed);
    }

    private static int firstHorizontalDirectionIndex(List<CubePoint> traversalPath) {
        if (traversalPath == null) {
            return -1;
        }
        for (int index = 1; index < traversalPath.size(); index++) {
            int directionIndex = horizontalDirectionIndex(traversalPath.get(index - 1), traversalPath.get(index));
            if (directionIndex >= 0) {
                return directionIndex;
            }
        }
        return -1;
    }

    private static int lastHorizontalDirectionIndex(List<CubePoint> traversalPath) {
        if (traversalPath == null) {
            return -1;
        }
        for (int index = traversalPath.size() - 1; index >= 1; index--) {
            int directionIndex = horizontalDirectionIndex(traversalPath.get(index - 1), traversalPath.get(index));
            if (directionIndex >= 0) {
                return directionIndex;
            }
        }
        return -1;
    }

    private static int horizontalDirectionIndex(CubePoint previous, CubePoint next) {
        if (previous == null || next == null || previous.z() == next.z()) {
            return -1;
        }
        int deltaX = next.x() - previous.x();
        int deltaY = next.y() - previous.y();
        for (int index = 0; index < CostField.HORIZONTAL_STEPS.size(); index++) {
            CubePoint step = CostField.HORIZONTAL_STEPS.get(index);
            if (step.x() == deltaX && step.y() == deltaY) {
                return index;
            }
        }
        return -1;
    }

    record StairNeighbor(
            CubePoint exitCell,
            List<CubePoint> footprint,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            int minZ,
            int maxZ,
            int entryDirectionIndex,
            int exitDirectionIndex,
            int cost
    ) {
        StairNeighbor {
            footprint = footprint == null ? List.of() : List.copyOf(footprint);
        }

        Point2i anchor() {
            return footprint.isEmpty() ? exitCell.projectedCell() : footprint.getFirst().projectedCell();
        }
    }
}
