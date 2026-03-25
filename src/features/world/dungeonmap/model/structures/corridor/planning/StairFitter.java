package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class StairFitter {

    private static final Comparator<Set<CubePoint>> COLUMN_ORDER = Comparator
            .comparingInt(StairFitter::minColumnZ)
            .thenComparing(StairFitter::minColumnCell, Point2i.POINT_ORDER);

    private StairFitter() {
    }

    static List<StairFitResult> fit(SteinerTree tree, PlannerContext context) {
        if (tree == null || context == null || tree.corridorCells().isEmpty()) {
            return List.of();
        }
        List<Set<CubePoint>> columns = groupVerticalColumns(tree.zTransitions());
        if (columns.isEmpty()) {
            return List.of();
        }
        List<StairFitResult> results = new ArrayList<>();
        for (Set<CubePoint> column : columns) {
            StairFitResult result = fitColumn(column, tree, context);
            if (result != null) {
                results.add(result);
            }
        }
        return List.copyOf(results);
    }

    private static List<Set<CubePoint>> groupVerticalColumns(Set<CubePoint> transitionCells) {
        if (transitionCells == null || transitionCells.isEmpty()) {
            return List.of();
        }
        Set<CubePoint> remaining = new LinkedHashSet<>(transitionCells);
        List<Set<CubePoint>> columns = new ArrayList<>();
        List<CubePoint> orderedCells = transitionCells.stream()
                .sorted(CubePoint.POINT_ORDER)
                .toList();
        for (CubePoint start : orderedCells) {
            if (start == null || !remaining.remove(start)) {
                continue;
            }
            ArrayDeque<CubePoint> queue = new ArrayDeque<>();
            Set<CubePoint> column = new LinkedHashSet<>();
            queue.addLast(start);
            column.add(start);
            while (!queue.isEmpty()) {
                CubePoint current = queue.removeFirst();
                for (CubePoint neighbor : verticalNeighbors(current)) {
                    if (!remaining.remove(neighbor)) {
                        continue;
                    }
                    column.add(neighbor);
                    queue.addLast(neighbor);
                }
            }
            columns.add(Set.copyOf(column));
        }
        columns.sort(COLUMN_ORDER);
        return List.copyOf(columns);
    }

    private static List<CubePoint> verticalNeighbors(CubePoint cell) {
        if (cell == null) {
            return List.of();
        }
        return List.of(
                cell.add(new CubePoint(0, 0, -1)),
                cell.add(new CubePoint(0, 0, 1)));
    }

    private static StairFitResult fitColumn(Set<CubePoint> column, SteinerTree tree, PlannerContext context) {
        if (column == null || column.isEmpty()) {
            return null;
        }
        CubePoint lowestCell = column.stream()
                .min(CubePoint.POINT_ORDER)
                .orElse(null);
        CubePoint highestCell = column.stream()
                .max(CubePoint.POINT_ORDER)
                .orElse(null);
        if (lowestCell == null || highestCell == null) {
            return null;
        }
        Point2i anchor = lowestCell.projectedCell();
        int minZ = lowestCell.z();
        int maxZ = highestCell.z();
        CardinalDirection direction = determineDirection(lowestCell, tree.corridorCells());
        ShapeSelection selection = selectShape(anchor, direction, minZ, maxZ, column, tree.corridorCells(), context.searchVolume());
        Set<CubePoint> bridgeCells = computeBridgeCells(selection, highestCell);
        List<Integer> exitLevels = column.stream()
                .map(CubePoint::z)
                .sorted()
                .distinct()
                .toList();
        return new StairFitResult(
                anchor,
                selection.shape(),
                direction,
                selection.dimension1(),
                selection.dimension2(),
                exitLevels,
                column,
                bridgeCells);
    }

    private static CardinalDirection determineDirection(CubePoint anchor, Set<CubePoint> corridorCells) {
        if (anchor == null || corridorCells == null || corridorCells.isEmpty()) {
            return CardinalDirection.NORTH;
        }
        for (Point2i step : Point2i.CARDINAL_STEPS) {
            CubePoint neighbor = CubePoint.at(anchor.projectedCell().add(step), anchor.z());
            if (corridorCells.contains(neighbor)) {
                return CardinalDirection.fromTravel(anchor, neighbor, CardinalDirection.NORTH);
            }
        }
        return CardinalDirection.NORTH;
    }

    private static ShapeSelection selectShape(
            Point2i anchor,
            CardinalDirection direction,
            int minZ,
            int maxZ,
            Set<CubePoint> columnCells,
            Set<CubePoint> corridorCells,
            SearchVolume searchVolume
    ) {
        List<CubePoint> straightPath = StairPathGenerator.generatePath(
                StairShape.STRAIGHT,
                anchor,
                direction,
                minZ,
                maxZ,
                0,
                0);
        if (isPathAvailable(straightPath, columnCells, corridorCells, searchVolume)) {
            return new ShapeSelection(StairShape.STRAIGHT, 0, 0, straightPath);
        }

        int height = maxZ - minZ + 1;
        if (height >= 4) {
            int sideLength = (int) Math.ceil(Math.sqrt(height));
            List<CubePoint> squarePath = StairPathGenerator.generatePath(
                    StairShape.SQUARE,
                    anchor,
                    direction,
                    minZ,
                    maxZ,
                    sideLength,
                    0);
            if (isPathAvailable(squarePath, columnCells, corridorCells, searchVolume)) {
                return new ShapeSelection(StairShape.SQUARE, sideLength, 0, squarePath);
            }
        }

        List<CubePoint> ladderPath = StairPathGenerator.generatePath(
                StairShape.LADDER,
                anchor,
                direction,
                minZ,
                maxZ,
                0,
                0);
        return new ShapeSelection(StairShape.LADDER, 0, 0, ladderPath);
    }

    private static boolean isPathAvailable(
            List<CubePoint> path,
            Set<CubePoint> columnCells,
            Set<CubePoint> corridorCells,
            SearchVolume searchVolume
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        for (CubePoint pathCell : path) {
            if (!searchVolume.isPassable(pathCell)) {
                return false;
            }
            if (corridorCells.contains(pathCell) && !columnCells.contains(pathCell)) {
                return false;
            }
        }
        return true;
    }

    private static Set<CubePoint> computeBridgeCells(ShapeSelection selection, CubePoint highestCell) {
        if (selection == null
                || highestCell == null
                || selection.shape() == StairShape.LADDER
                || selection.path().isEmpty()) {
            return Set.of();
        }
        Point2i originalTop = highestCell.projectedCell();
        Point2i exitCell = selection.path().getLast().projectedCell();
        if (originalTop.equals(exitCell)) {
            return Set.of();
        }
        Set<CubePoint> bridgeCells = new LinkedHashSet<>();
        int x = originalTop.x();
        int y = originalTop.y();
        bridgeCells.add(new CubePoint(x, y, highestCell.z()));
        while (x != exitCell.x()) {
            x += Integer.signum(exitCell.x() - x);
            bridgeCells.add(new CubePoint(x, y, highestCell.z()));
        }
        while (y != exitCell.y()) {
            y += Integer.signum(exitCell.y() - y);
            bridgeCells.add(new CubePoint(x, y, highestCell.z()));
        }
        return Set.copyOf(bridgeCells);
    }

    private static int minColumnZ(Set<CubePoint> column) {
        return column == null ? Integer.MAX_VALUE : column.stream()
                .mapToInt(CubePoint::z)
                .min()
                .orElse(Integer.MAX_VALUE);
    }

    private static Point2i minColumnCell(Set<CubePoint> column) {
        return column == null ? new Point2i(Integer.MAX_VALUE, Integer.MAX_VALUE) : column.stream()
                .map(CubePoint::projectedCell)
                .min(Point2i.POINT_ORDER)
                .orElse(new Point2i(Integer.MAX_VALUE, Integer.MAX_VALUE));
    }

    private record ShapeSelection(
            StairShape shape,
            int dimension1,
            int dimension2,
            List<CubePoint> path
    ) {
    }
}
