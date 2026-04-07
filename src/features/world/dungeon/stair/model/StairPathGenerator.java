package features.world.dungeon.stair.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class StairPathGenerator {

    private StairPathGenerator() {
        throw new AssertionError("No instances");
    }

    public static GridPath generate(
            StairPathPatternSpec spec,
            GridPoint anchorCell,
            int anchorLevelZ,
            int minLevelZ,
            int maxLevelZ
    ) {
        StairPathPatternSpec resolvedSpec = spec == null ? StairPathPatternSpec.defaultSpec() : spec;
        if (anchorCell == null) {
            return GridPath.empty();
        }
        if (anchorCell.kind() != GridPoint.Kind.CELL) {
            throw new IllegalArgumentException("Treppenanker muss eine Zelle sein");
        }
        if (maxLevelZ < minLevelZ) {
            throw new IllegalArgumentException("maxLevelZ darf nicht kleiner als minLevelZ sein");
        }
        if (anchorLevelZ < minLevelZ || anchorLevelZ > maxLevelZ) {
            throw new IllegalArgumentException("Anker-Ebene liegt außerhalb der Shape-Spanne");
        }
        String validationMessage = resolvedSpec.validate().orElse(null);
        if (validationMessage != null) {
            throw new IllegalArgumentException(validationMessage);
        }
        int stepCount = maxLevelZ - minLevelZ + 1;
        List<GridPoint> relativePath = projectedPath(resolvedSpec, GridPoint.cell(0, 0, 0), stepCount);
        int anchorIndex = anchorLevelZ - minLevelZ;
        GridPoint relativeAnchor = relativePath.get(anchorIndex);
        int dxCells = anchorCell.cellX() - relativeAnchor.cellX();
        int dyCells = anchorCell.cellY() - relativeAnchor.cellY();
        List<GridPoint> planarPath = relativePath.stream()
                .map(point -> GridPoint.cell(point.cellX() + dxCells, point.cellY() + dyCells, 0))
                .toList();
        validateEdgeConnectivity(planarPath);
        ArrayList<GridPoint> result = new ArrayList<>(planarPath.size());
        for (int index = 0; index < planarPath.size(); index++) {
            GridPoint point = planarPath.get(index);
            result.add(GridPoint.cell(point.cellX(), point.cellY(), minLevelZ + index));
        }
        return GridPath.of(result);
    }

    private static List<GridPoint> projectedPath(
            StairPathPatternSpec spec,
            GridPoint anchor,
            int stepCount
    ) {
        StairPathPatternSpec resolvedSpec = spec == null ? StairPathPatternSpec.defaultSpec() : spec;
        return switch (resolvedSpec.kind()) {
            case STACK -> repeatedCellPath(anchor, stepCount);
            case LINE -> straightPath(anchor, resolvedSpec.direction(), stepCount);
            case SQUARE -> spiralPath(anchor, resolvedSpec.direction(), stepCount, resolvedSpec.parameter1(), resolvedSpec.parameter1());
            case RECTANGLE -> spiralPath(anchor, resolvedSpec.direction(), stepCount, resolvedSpec.parameter1(), resolvedSpec.parameter2());
            case CIRCLE -> circularPath(anchor, resolvedSpec.direction(), stepCount, resolvedSpec.parameter1());
        };
    }

    private static List<GridPoint> repeatedCellPath(GridPoint anchor, int stepCount) {
        ArrayList<GridPoint> result = new ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(anchor);
        }
        return List.copyOf(result);
    }

    private static List<GridPoint> straightPath(GridPoint anchor, CardinalDirection direction, int stepCount) {
        ArrayList<GridPoint> result = new ArrayList<>(stepCount);
        GridPoint current = anchor;
        result.add(current);
        for (int index = 1; index < stepCount; index++) {
            current = current.step(direction);
            result.add(current);
        }
        return List.copyOf(result);
    }

    private static List<GridPoint> spiralPath(
            GridPoint anchor,
            CardinalDirection direction,
            int stepCount,
            int firstSegmentLength,
            int secondSegmentLength
    ) {
        ArrayList<GridPoint> result = new ArrayList<>(stepCount);
        GridPoint current = anchor;
        CardinalDirection currentDirection = direction;
        int segmentIndex = 0;
        int segmentSteps = 0;
        int currentSegmentLength = firstSegmentLength;
        result.add(current);
        for (int index = 1; index < stepCount; index++) {
            current = current.step(currentDirection);
            result.add(current);
            segmentSteps++;
            if (segmentSteps >= currentSegmentLength) {
                currentDirection = currentDirection.clockwise();
                segmentIndex++;
                segmentSteps = 0;
                currentSegmentLength = segmentIndex % 2 == 0 ? firstSegmentLength : secondSegmentLength;
            }
        }
        return List.copyOf(result);
    }

    private static List<GridPoint> circularPath(
            GridPoint anchor,
            CardinalDirection direction,
            int stepCount,
            int radius
    ) {
        List<GridPoint> loop = circularLoop(anchor, radius);
        if (loop.isEmpty()) {
            throw new IllegalArgumentException("Kreisförmiger Shape-Pfad konnte nicht erzeugt werden");
        }
        int startIndex = startIndexForDirection(loop, anchor, direction);
        ArrayList<GridPoint> result = new ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(loop.get((startIndex + index) % loop.size()));
        }
        return List.copyOf(result);
    }

    private static List<GridPoint> circularLoop(GridPoint anchor, int radius) {
        Set<GridPoint> ringPoints = midpointCirclePoints(anchor, radius);
        return ringPoints.stream()
                .sorted(Comparator
                        .comparingDouble((GridPoint point) -> normalizedAngle(anchor, point))
                        .thenComparingInt(GridPoint::cellY)
                        .thenComparingInt(GridPoint::cellX))
                .toList();
    }

    private static Set<GridPoint> midpointCirclePoints(GridPoint anchor, int radius) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        int x = radius;
        int y = 0;
        int error = 1 - radius;
        while (x >= y) {
            addCircleOctants(result, anchor, x, y);
            y++;
            if (error < 0) {
                error += 2 * y + 1;
            } else {
                x--;
                error += 2 * (y - x) + 1;
            }
        }
        return result;
    }

    private static void addCircleOctants(Set<GridPoint> target, GridPoint anchor, int x, int y) {
        target.add(GridPoint.cell(anchor.cellX() + x, anchor.cellY() + y, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() + y, anchor.cellY() + x, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() - y, anchor.cellY() + x, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() - x, anchor.cellY() + y, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() - x, anchor.cellY() - y, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() - y, anchor.cellY() - x, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() + y, anchor.cellY() - x, anchor.z()));
        target.add(GridPoint.cell(anchor.cellX() + x, anchor.cellY() - y, anchor.z()));
    }

    private static double normalizedAngle(GridPoint anchor, GridPoint point) {
        double angle = Math.atan2(point.cellY() - anchor.cellY(), point.cellX() - anchor.cellX());
        return angle < 0 ? angle + Math.PI * 2.0 : angle;
    }

    private static int startIndexForDirection(List<GridPoint> loop, GridPoint anchor, CardinalDirection direction) {
        if (loop.isEmpty()) {
            return 0;
        }
        Objects.requireNonNull(anchor, "anchor");
        CardinalDirection resolvedDirection = direction == null ? CardinalDirection.defaultDirection() : direction;
        GridPoint preferred = anchor.step(resolvedDirection);
        int preferredIndex = loop.indexOf(preferred);
        return preferredIndex >= 0 ? preferredIndex : 0;
    }

    private static void validateEdgeConnectivity(List<GridPoint> points) {
        GridPoint previous = null;
        for (GridPoint current : points) {
            if (previous != null) {
                int distance = Math.abs(previous.cellX() - current.cellX())
                        + Math.abs(previous.cellY() - current.cellY());
                if (distance > 1) {
                    throw new IllegalArgumentException("Treppenpfad verletzt die 1:1-Steigung");
                }
            }
            previous = current;
        }
    }
}
