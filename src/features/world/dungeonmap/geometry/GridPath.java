package features.world.dungeonmap.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class GridPath extends GridObject {

    private final List<GridPoint> points;
    private final Map<Integer, GridArea> areasByLevel;

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
        List<GridPoint> relativePath = projectedPath(
                resolvedSpec,
                new GridPoint(0, 0),
                stepCount);
        int anchorIndex = anchorLevelZ - minLevelZ;
        GridPoint relativeAnchor = relativePath.get(anchorIndex);
        GridPoint offset = GridPoint.cell(anchorCell).subtract(relativeAnchor);
        List<GridPoint> projectedPath = relativePath.stream()
                .map(point -> GridPoint.cell(point.add(offset)))
                .toList();
        validateEdgeConnectivity(projectedPath);
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>(projectedPath.size());
        for (int index = 0; index < projectedPath.size(); index++) {
            GridPoint point = projectedPath.get(index);
            result.add(new GridPoint(point.x(), point.y(), minLevelZ + index));
        }
        return of(result);
    }

    protected GridPath(Collection<GridPoint> points) {
        this.points = normalizePoints(points);
        this.areasByLevel = indexAreasByLevel(this.points);
    }

    public boolean isEmpty() {
        return points.isEmpty();
    }

    public List<GridPoint> points() {
        return points;
    }

    public Set<GridPoint> pointSet() {
        return points.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(points));
    }

    @Override
    public Set<Integer> levels() {
        return areasByLevel.keySet();
    }

    @Override
    public int primaryLevel() {
        return areasByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public GridArea areaAtLevel(int levelZ) {
        return areasByLevel.getOrDefault(levelZ, GridArea.empty());
    }

    public GridArea shapeAtLevel(int levelZ) {
        return areaAtLevel(levelZ);
    }

    public Set<GridPoint> cellPointsAtLevel(int levelZ) {
        return areaAtLevel(levelZ).cellPoints();
    }

    public Set<GridPoint> cellCoordsAtLevel(int levelZ) {
        return cellPointsAtLevel(levelZ);
    }

    public boolean contains(GridPoint point) {
        return point != null && points.contains(point);
    }

    @Override
    public GridPath translatedByCells(int dx, int dy, int dz) {
        if (dx == 0 && dy == 0 && dz == 0) {
            return this;
        }
        return new GridPath(points.stream()
                .map(point -> point.translatedByCells(dx, dy, dz))
                .toList());
    }

    public GridPath translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return translatedByCells(resolvedDelta.x(), resolvedDelta.y(), resolvedDelta.z());
    }

    public GridPath translatedBy(GridPoint delta, int levelDelta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return translatedByCells(resolvedDelta.x(), resolvedDelta.y(), levelDelta);
    }

    @Override
    public GridArea cellFootprint() {
        LinkedHashSet<GridPoint> footprint = new LinkedHashSet<>();
        for (GridPoint point : points) {
            footprint.add(point.projectedCell());
        }
        return footprint.isEmpty() ? GridArea.empty() : new GridArea(footprint);
    }

    private static Map<Integer, GridArea> indexAreasByLevel(List<GridPoint> points) {
        if (points == null || points.isEmpty()) {
            return Map.of();
        }
        Map<Integer, LinkedHashSet<GridPoint>> mutable = new LinkedHashMap<>();
        for (GridPoint point : points) {
            mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                    .add(point.projectedCell());
        }
        Map<Integer, GridArea> result = new LinkedHashMap<>();
        mutable.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), new GridArea(entry.getValue())));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<GridPoint> normalizePoints(Collection<GridPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>();
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
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(anchor);
        }
        return List.copyOf(result);
    }

    private static List<GridPoint> straightPath(GridPoint anchor, CardinalDirection direction, int stepCount) {
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>(stepCount);
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
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>(stepCount);
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
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(loop.get((startIndex + index) % loop.size()));
        }
        return List.copyOf(result);
    }

    private static List<GridPoint> circularLoop(GridPoint anchor, int radius) {
        Set<GridPoint> ringPoints = midpointCirclePoints(anchor, radius);
        List<GridPoint> ordered = ringPoints.stream()
                .sorted(Comparator
                        .comparingDouble((GridPoint point) -> normalizedAngle(anchor, point))
                        .thenComparingInt(GridPoint::y)
                        .thenComparingInt(GridPoint::x))
                .toList();
        if (ordered.isEmpty()) {
            return List.of();
        }
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>();
        for (int index = 0; index < ordered.size(); index++) {
            GridPoint current = ordered.get(index);
            GridPoint next = ordered.get((index + 1) % ordered.size());
            appendInterpolatedSegment(result, current, next, index == 0);
        }
        return deduplicateSequential(result);
    }

    private static Set<GridPoint> midpointCirclePoints(GridPoint anchor, int radius) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        int x = radius;
        int y = 0;
        int decision = 1 - radius;
        while (x >= y) {
            addCircleSymmetryPoints(result, anchor, x, y);
            y++;
            if (decision < 0) {
                decision += 2 * y + 1;
            } else {
                x--;
                decision += 2 * (y - x) + 1;
            }
        }
        return result;
    }

    private static void addCircleSymmetryPoints(Set<GridPoint> points, GridPoint anchor, int x, int y) {
        addPoint(points, anchor, x, y);
        addPoint(points, anchor, y, x);
        addPoint(points, anchor, -y, x);
        addPoint(points, anchor, -x, y);
        addPoint(points, anchor, -x, -y);
        addPoint(points, anchor, -y, -x);
        addPoint(points, anchor, y, -x);
        addPoint(points, anchor, x, -y);
    }

    private static void addPoint(Set<GridPoint> points, GridPoint anchor, int dx, int dy) {
        points.add(new GridPoint(anchor.x() + dx, anchor.y() + dy, anchor.z()));
    }

    private static double normalizedAngle(GridPoint anchor, GridPoint point) {
        double angle = Math.atan2(point.y() - anchor.y(), point.x() - anchor.x());
        return angle < 0 ? angle + Math.PI * 2.0 : angle;
    }

    private static int startIndexForDirection(List<GridPoint> loop, GridPoint anchor, CardinalDirection direction) {
        GridPoint delta = direction.delta();
        double targetAngle = Math.atan2(delta.y(), delta.x());
        if (targetAngle < 0) {
            targetAngle += Math.PI * 2.0;
        }
        int bestIndex = 0;
        double bestScore = Double.MAX_VALUE;
        for (int index = 0; index < loop.size(); index++) {
            GridPoint point = loop.get(index);
            double angle = normalizedAngle(anchor, point);
            double angleDistance = Math.abs(angle - targetAngle);
            angleDistance = Math.min(angleDistance, Math.PI * 2.0 - angleDistance);
            int radialDistance = Math.abs(point.x() - anchor.x()) + Math.abs(point.y() - anchor.y());
            double score = angleDistance * 1000.0 + radialDistance;
            if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private static void appendInterpolatedSegment(List<GridPoint> points, GridPoint start, GridPoint end, boolean includeStart) {
        GridPoint current = start;
        if (includeStart) {
            points.add(current);
        }
        while (current.x() != end.x()) {
            current = new GridPoint(current.x() + Integer.signum(end.x() - current.x()), current.y(), current.z());
            points.add(current);
        }
        while (current.y() != end.y()) {
            current = new GridPoint(current.x(), current.y() + Integer.signum(end.y() - current.y()), current.z());
            points.add(current);
        }
    }

    private static List<GridPoint> deduplicateSequential(Collection<GridPoint> points) {
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>();
        GridPoint previous = null;
        for (GridPoint point : points) {
            if (point != null && !Objects.equals(point, previous)) {
                result.add(point);
                previous = point;
            }
        }
        return List.copyOf(result);
    }

    static void validateEdgeConnectivity(List<GridPoint> path) {
        GridPoint previous = null;
        for (GridPoint current : path == null ? List.<GridPoint>of() : path) {
            if (current == null) {
                throw new IllegalArgumentException("Shape-Pfad darf keine Null-Zellen enthalten");
            }
            if (previous != null) {
                int deltaX = Math.abs(current.x() - previous.x());
                int deltaY = Math.abs(current.y() - previous.y());
                if (deltaX + deltaY > 1) {
                    throw new IllegalArgumentException("Shape-Pfad verletzt die Kantenverbindung");
                }
            }
            previous = current;
        }
    }
}
