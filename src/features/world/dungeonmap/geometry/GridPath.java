package features.world.dungeonmap.geometry;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GridPath extends GridObject {

    private final List<GridPoint> points;

    public static GridPath empty() {
        return new GridPath(List.of());
    }

    public static GridPath of(Collection<GridPoint> points) {
        return new GridPath(points);
    }

    public static GridPath generate(
            GridPathPatternSpec spec,
            GridPoint anchorCell,
            int anchorLevelZ,
            int minLevelZ,
            int maxLevelZ
    ) {
        GridPathPatternSpec resolvedSpec = spec == null ? GridPathPatternSpec.defaultSpec() : spec;
        if (anchorCell == null) {
            return empty();
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
        GridPoint offset = anchorCell.subtract(relativeAnchor);
        List<GridPoint> projectedPath = relativePath.stream()
                .map(point -> GridPoint.cell(point.add(offset)))
                .toList();
        validateEdgeConnectivity(projectedPath);
        ArrayList<GridPoint> result = new ArrayList<>(projectedPath.size());
        for (int index = 0; index < projectedPath.size(); index++) {
            GridPoint point = projectedPath.get(index);
            result.add(new GridPoint(point.x(), point.y(), minLevelZ + index));
        }
        return of(result);
    }

    public GridPath(Collection<GridPoint> points) {
        this.points = normalizePoints(points);
    }

    public boolean isEmpty() {
        return points.isEmpty();
    }

    public List<GridPoint> points() {
        return points;
    }

    public List<GridSegment> segments() {
        if (points.size() < 2) {
            return List.of();
        }
        ArrayList<GridSegment> result = new ArrayList<>();
        for (int index = 1; index < points.size(); index++) {
            GridPoint start = points.get(index - 1);
            GridPoint end = points.get(index);
            if (start.z() != end.z()) {
                throw new IllegalStateException("GridPath.segments requires same-level points");
            }
            result.add(new GridSegment(start, end));
        }
        return List.copyOf(result);
    }

    public List<GridPoint> turnPoints() {
        List<GridSegment> segments = segments();
        if (segments.size() < 2) {
            return List.of();
        }
        ArrayList<GridPoint> result = new ArrayList<>();
        for (int index = 1; index < segments.size(); index++) {
            GridSegment previous = segments.get(index - 1);
            GridSegment current = segments.get(index);
            if (previous.orientation() != current.orientation()) {
                result.add(current.start());
            }
        }
        return List.copyOf(result);
    }

    public boolean contains(GridPoint point) {
        return point != null && points.contains(point);
    }

    @Override
    public GridPath translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new GridPath(points.stream().map(point -> point.translated(resolvedTranslation)).toList());
    }

    @Override
    public Set<Integer> levels() {
        if (points.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (GridPoint point : points) {
            levels.add(point.z());
        }
        return Set.copyOf(levels);
    }

    @Override
    public GridArea cellFootprint() {
        LinkedHashSet<GridPoint> cells = new LinkedHashSet<>();
        for (GridPoint point : points) {
            cells.addAll(point.touchingCells().cells());
        }
        return cells.isEmpty() ? GridArea.empty() : GridArea.of(cells);
    }

    private static List<GridPoint> normalizePoints(Collection<GridPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        ArrayList<GridPoint> result = new ArrayList<>();
        for (GridPoint point : points) {
            if (point != null) {
                result.add(point);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<GridPoint> projectedPath(
            GridPathPatternSpec spec,
            GridPoint anchor,
            int stepCount
    ) {
        GridPathPatternSpec resolvedSpec = spec == null ? GridPathPatternSpec.defaultSpec() : spec;
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
            current = GridPoint.cell(current.add(direction.delta()));
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
            current = GridPoint.cell(current.add(currentDirection.delta()));
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
                        .thenComparingInt(GridPoint::y)
                        .thenComparingInt(GridPoint::x))
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
        target.add(GridPoint.cell(anchor.x() + x, anchor.y() + y, anchor.z()));
        target.add(GridPoint.cell(anchor.x() + y, anchor.y() + x, anchor.z()));
        target.add(GridPoint.cell(anchor.x() - y, anchor.y() + x, anchor.z()));
        target.add(GridPoint.cell(anchor.x() - x, anchor.y() + y, anchor.z()));
        target.add(GridPoint.cell(anchor.x() - x, anchor.y() - y, anchor.z()));
        target.add(GridPoint.cell(anchor.x() - y, anchor.y() - x, anchor.z()));
        target.add(GridPoint.cell(anchor.x() + y, anchor.y() - x, anchor.z()));
        target.add(GridPoint.cell(anchor.x() + x, anchor.y() - y, anchor.z()));
    }

    private static int startIndexForDirection(List<GridPoint> loop, GridPoint anchor, CardinalDirection direction) {
        GridPoint expectedStart = GridPoint.cell(anchor.add(direction.delta()));
        int index = loop.indexOf(expectedStart);
        return index >= 0 ? index : 0;
    }

    private static double normalizedAngle(GridPoint anchor, GridPoint point) {
        double angle = Math.atan2(point.y() - anchor.y(), point.x() - anchor.x());
        return angle < 0 ? angle + Math.PI * 2.0d : angle;
    }

    private static void validateEdgeConnectivity(List<GridPoint> path) {
        GridPoint previous = null;
        for (GridPoint current : path) {
            if (previous != null && previous.manhattanDistance(current) > 1) {
                throw new IllegalArgumentException("Shape-Pfad enthält nicht-adjizente Schritte");
            }
            previous = current;
        }
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridPath path)) {
            return false;
        }
        return Objects.equals(points, path.points);
    }

    @Override
    public int hashCode() {
        return Objects.hash(points);
    }

    @Override
    public String toString() {
        return "GridPath[points=" + points + "]";
    }
}
