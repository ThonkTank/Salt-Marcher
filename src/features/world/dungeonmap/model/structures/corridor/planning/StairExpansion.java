package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class StairExpansion {

    private static final int STAIR_COST_PER_LEVEL = 2;

    private StairExpansion() {
    }

    static List<StairNeighbor> expand(CubePoint cell, SearchVolume volume, Set<CubePoint> treeCells) {
        if (cell == null || volume == null) {
            return List.of();
        }
        List<StairNeighbor> results = new ArrayList<>();
        for (CardinalDirection direction : CardinalDirection.values()) {
            expandDirected(cell, direction, true, volume, treeCells, results);
            expandDirected(cell, direction, false, volume, treeCells, results);
        }
        expandLadder(cell, true, volume, treeCells, results);
        expandLadder(cell, false, volume, treeCells, results);
        return List.copyOf(results);
    }

    private static void expandDirected(
            CubePoint cell,
            CardinalDirection direction,
            boolean ascending,
            SearchVolume volume,
            Set<CubePoint> treeCells,
            List<StairNeighbor> results
    ) {
        int maxDelta = ascending
                ? volume.maxZ() - cell.z()
                : cell.z() - volume.minZ();
        if (maxDelta < 1) {
            return;
        }
        for (StairShape shape : List.of(StairShape.STRAIGHT, StairShape.SQUARE)) {
            for (int delta = 1; delta <= maxDelta; delta++) {
                int minZ = ascending ? cell.z() : cell.z() - delta;
                int maxZ = ascending ? cell.z() + delta : cell.z();
                int height = maxZ - minZ + 1;

                int dimension1 = 0;
                int dimension2 = 0;
                if (shape == StairShape.SQUARE) {
                    if (height < 4) {
                        break;
                    }
                    dimension1 = (int) Math.ceil(Math.sqrt(height));
                }

                List<CubePoint> path;
                try {
                    Point2i anchor = resolveAnchor(cell, direction, shape, height, dimension1, dimension2, ascending);
                    path = StairPathGenerator.generatePath(
                            shape,
                            anchor,
                            direction,
                            minZ,
                            maxZ,
                            dimension1,
                            dimension2);
                } catch (IllegalArgumentException ignored) {
                    break;
                }
                if (path.isEmpty()) {
                    continue;
                }
                if (!containsTraversalEndpoint(path, cell, ascending)) {
                    continue;
                }
                if (!volume.isFootprintPassable(path) || collidesWithTree(path, treeCells, cell)) {
                    continue;
                }
                CubePoint exitCell = ascending ? path.getLast() : path.getFirst();
                List<CubePoint> traversalPath = traversalPath(path, ascending);
                results.add(new StairNeighbor(
                        exitCell,
                        path,
                        shape,
                        direction,
                        dimension1,
                        dimension2,
                        minZ,
                        maxZ,
                        firstHorizontalDirectionIndex(traversalPath),
                        lastHorizontalDirectionIndex(traversalPath),
                        height * STAIR_COST_PER_LEVEL));
            }
        }
    }

    private static void expandLadder(
            CubePoint cell,
            boolean ascending,
            SearchVolume volume,
            Set<CubePoint> treeCells,
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
            int height = maxZ - minZ + 1;
            List<CubePoint> path = StairPathGenerator.generatePath(
                    StairShape.LADDER,
                    cell.projectedCell(),
                    CardinalDirection.defaultDirection(),
                    minZ,
                    maxZ,
                    0,
                    0);
            if (!containsTraversalEndpoint(path, cell, ascending)) {
                continue;
            }
            if (!volume.isFootprintPassable(path) || collidesWithTree(path, treeCells, cell)) {
                continue;
            }
            CubePoint exitCell = ascending ? path.getLast() : path.getFirst();
            List<CubePoint> traversalPath = traversalPath(path, ascending);
            results.add(new StairNeighbor(
                    exitCell,
                    path,
                    StairShape.LADDER,
                    CardinalDirection.defaultDirection(),
                    0,
                    0,
                    minZ,
                    maxZ,
                    firstHorizontalDirectionIndex(traversalPath),
                    lastHorizontalDirectionIndex(traversalPath),
                    height * STAIR_COST_PER_LEVEL));
        }
    }

    private static Point2i resolveAnchor(
            CubePoint cell,
            CardinalDirection direction,
            StairShape shape,
            int height,
            int dimension1,
            int dimension2,
            boolean ascending
    ) {
        if (ascending || shape == StairShape.LADDER) {
            return cell.projectedCell();
        }
        List<CubePoint> template = StairPathGenerator.generatePath(
                shape,
                new Point2i(0, 0),
                direction,
                0,
                height - 1,
                dimension1,
                dimension2);
        if (template.isEmpty()) {
            return cell.projectedCell();
        }
        Point2i templateTerminal = template.getLast().projectedCell();
        return cell.projectedCell().subtract(templateTerminal);
    }

    private static boolean containsTraversalEndpoint(List<CubePoint> path, CubePoint cell, boolean ascending) {
        if (path == null || path.isEmpty() || cell == null) {
            return false;
        }
        return ascending ? cell.equals(path.getFirst()) : cell.equals(path.getLast());
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

    private static boolean collidesWithTree(List<CubePoint> path, Set<CubePoint> treeCells, CubePoint origin) {
        if (treeCells == null || treeCells.isEmpty()) {
            return false;
        }
        for (CubePoint cell : path) {
            if (!cell.equals(origin) && treeCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }
}
