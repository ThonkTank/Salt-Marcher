package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical ordered 3D path for authored stair-style movement geometry.
 *
 * <p>This type owns ordered path semantics. Unordered occupied surfaces remain on {@link TileShape}.</p>
 */
public final class TilePath {

    private final List<CubePoint> points;
    private final Map<Integer, TileShape> shapesByLevel;

    public static TilePath empty() {
        return new TilePath(List.of());
    }

    public static TilePath of(Collection<CubePoint> cubePoints) {
        return new TilePath(normalizePoints(cubePoints));
    }

    public static TilePath generate(
            TileShapeSpec spec,
            CellCoord anchorCell,
            int anchorLevelZ,
            int minLevelZ,
            int maxLevelZ
    ) {
        TileShapeSpec resolvedSpec = spec == null ? TileShapeSpec.defaultSpec() : spec;
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
        List<CellCoord> relativePath = projectedPath(
                resolvedSpec,
                new CellCoord(0, 0),
                stepCount);
        int anchorIndex = anchorLevelZ - minLevelZ;
        CellCoord relativeAnchor = relativePath.get(anchorIndex);
        CellCoord offset = anchorCell.subtract(relativeAnchor);
        List<CellCoord> projectedPath = relativePath.stream()
                .map(cell -> cell.add(offset))
                .toList();
        validateEdgeConnectivity(projectedPath);
        java.util.ArrayList<CubePoint> result = new java.util.ArrayList<>(projectedPath.size());
        for (int index = 0; index < projectedPath.size(); index++) {
            result.add(CubePoint.at(projectedPath.get(index), minLevelZ + index));
        }
        return of(result);
    }

    private TilePath(List<CubePoint> points) {
        this.points = points == null ? List.of() : List.copyOf(points);
        this.shapesByLevel = indexShapesByLevel(this.points);
    }

    public boolean isEmpty() {
        return points.isEmpty();
    }

    public List<CubePoint> points() {
        return points;
    }

    public Set<CubePoint> pointSet() {
        return points.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(points));
    }

    public Set<Integer> levels() {
        return shapesByLevel.keySet();
    }

    public int primaryLevel() {
        return shapesByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public TileShape shapeAtLevel(int levelZ) {
        return shapesByLevel.getOrDefault(levelZ, TileShape.empty());
    }

    public Set<CellCoord> cellCoordsAtLevel(int levelZ) {
        return shapeAtLevel(levelZ).cellCoords();
    }

    public boolean contains(CubePoint point) {
        return point != null && points.contains(point);
    }

    public TilePath translatedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        return new TilePath(points.stream()
                .map(point -> CubePoint.at(point.projectedCell().add(resolvedDelta), point.z() + levelDelta))
                .toList());
    }

    private static Map<Integer, TileShape> indexShapesByLevel(List<CubePoint> points) {
        if (points == null || points.isEmpty()) {
            return Map.of();
        }
        Map<Integer, LinkedHashSet<CellCoord>> mutable = new LinkedHashMap<>();
        for (CubePoint point : points) {
            mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                    .add(point.projectedCell());
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        mutable.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), new TileShape(entry.getValue())));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<CubePoint> normalizePoints(Collection<CubePoint> cubePoints) {
        if (cubePoints == null || cubePoints.isEmpty()) {
            return List.of();
        }
        java.util.ArrayList<CubePoint> result = new java.util.ArrayList<>();
        for (CubePoint point : cubePoints) {
            if (point != null) {
                result.add(point);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CellCoord> projectedPath(
            TileShapeSpec spec,
            CellCoord anchor,
            int stepCount
    ) {
        TileShapeSpec resolvedSpec = spec == null ? TileShapeSpec.defaultSpec() : spec;
        return switch (resolvedSpec.kind()) {
            case STACK -> repeatedCellPath(anchor, stepCount);
            case LINE -> straightPath(anchor, resolvedSpec.direction(), stepCount);
            case SQUARE -> spiralPath(anchor, resolvedSpec.direction(), stepCount, resolvedSpec.parameter1(), resolvedSpec.parameter1());
            case RECTANGLE -> spiralPath(anchor, resolvedSpec.direction(), stepCount, resolvedSpec.parameter1(), resolvedSpec.parameter2());
            case CIRCLE -> circularPath(anchor, resolvedSpec.direction(), stepCount, resolvedSpec.parameter1());
        };
    }

    private static List<CellCoord> repeatedCellPath(CellCoord anchor, int stepCount) {
        java.util.ArrayList<CellCoord> result = new java.util.ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(anchor);
        }
        return List.copyOf(result);
    }

    private static List<CellCoord> straightPath(CellCoord anchor, CardinalDirection direction, int stepCount) {
        java.util.ArrayList<CellCoord> result = new java.util.ArrayList<>(stepCount);
        CellCoord current = anchor;
        result.add(current);
        for (int index = 1; index < stepCount; index++) {
            current = current.add(direction.delta());
            result.add(current);
        }
        return List.copyOf(result);
    }

    private static List<CellCoord> spiralPath(
            CellCoord anchor,
            CardinalDirection direction,
            int stepCount,
            int firstSegmentLength,
            int secondSegmentLength
    ) {
        java.util.ArrayList<CellCoord> result = new java.util.ArrayList<>(stepCount);
        CellCoord current = anchor;
        CardinalDirection currentDirection = direction;
        int segmentIndex = 0;
        int segmentSteps = 0;
        int currentSegmentLength = firstSegmentLength;
        result.add(current);
        for (int index = 1; index < stepCount; index++) {
            current = current.add(currentDirection.delta());
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

    private static List<CellCoord> circularPath(
            CellCoord anchor,
            CardinalDirection direction,
            int stepCount,
            int radius
    ) {
        List<CellCoord> loop = circularLoop(anchor, radius);
        if (loop.isEmpty()) {
            throw new IllegalArgumentException("Kreisförmiger Shape-Pfad konnte nicht erzeugt werden");
        }
        int startIndex = startIndexForDirection(loop, anchor, direction);
        java.util.ArrayList<CellCoord> result = new java.util.ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(loop.get((startIndex + index) % loop.size()));
        }
        return List.copyOf(result);
    }

    private static List<CellCoord> circularLoop(CellCoord anchor, int radius) {
        Set<CellCoord> ringPoints = midpointCirclePoints(anchor, radius);
        List<CellCoord> ordered = ringPoints.stream()
                .sorted(Comparator
                        .comparingDouble((CellCoord point) -> normalizedAngle(anchor, point))
                        .thenComparingInt(CellCoord::y)
                        .thenComparingInt(CellCoord::x))
                .toList();
        if (ordered.isEmpty()) {
            return List.of();
        }
        java.util.ArrayList<CellCoord> result = new java.util.ArrayList<>();
        for (int index = 0; index < ordered.size(); index++) {
            CellCoord current = ordered.get(index);
            CellCoord next = ordered.get((index + 1) % ordered.size());
            appendInterpolatedSegment(result, current, next, index == 0);
        }
        return deduplicateSequential(result);
    }

    private static Set<CellCoord> midpointCirclePoints(CellCoord anchor, int radius) {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
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

    private static void addCircleSymmetryPoints(Set<CellCoord> points, CellCoord anchor, int x, int y) {
        addPoint(points, anchor, x, y);
        addPoint(points, anchor, y, x);
        addPoint(points, anchor, -y, x);
        addPoint(points, anchor, -x, y);
        addPoint(points, anchor, -x, -y);
        addPoint(points, anchor, -y, -x);
        addPoint(points, anchor, y, -x);
        addPoint(points, anchor, x, -y);
    }

    private static void addPoint(Set<CellCoord> points, CellCoord anchor, int dx, int dy) {
        points.add(new CellCoord(anchor.x() + dx, anchor.y() + dy));
    }

    private static double normalizedAngle(CellCoord anchor, CellCoord point) {
        double angle = Math.atan2(point.y() - anchor.y(), point.x() - anchor.x());
        return angle < 0 ? angle + Math.PI * 2.0 : angle;
    }

    private static int startIndexForDirection(List<CellCoord> loop, CellCoord anchor, CardinalDirection direction) {
        CellCoord delta = direction.delta();
        double targetAngle = Math.atan2(delta.y(), delta.x());
        if (targetAngle < 0) {
            targetAngle += Math.PI * 2.0;
        }
        int bestIndex = 0;
        double bestScore = Double.MAX_VALUE;
        for (int index = 0; index < loop.size(); index++) {
            CellCoord point = loop.get(index);
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

    private static void appendInterpolatedSegment(List<CellCoord> points, CellCoord start, CellCoord end, boolean includeStart) {
        CellCoord current = start;
        if (includeStart) {
            points.add(current);
        }
        while (current.x() != end.x()) {
            current = new CellCoord(current.x() + Integer.signum(end.x() - current.x()), current.y());
            points.add(current);
        }
        while (current.y() != end.y()) {
            current = new CellCoord(current.x(), current.y() + Integer.signum(end.y() - current.y()));
            points.add(current);
        }
    }

    private static List<CellCoord> deduplicateSequential(Collection<CellCoord> points) {
        java.util.ArrayList<CellCoord> result = new java.util.ArrayList<>();
        CellCoord previous = null;
        for (CellCoord point : points) {
            if (point != null && !Objects.equals(point, previous)) {
                result.add(point);
                previous = point;
            }
        }
        return List.copyOf(result);
    }

    static void validateEdgeConnectivity(List<CellCoord> path) {
        CellCoord previous = null;
        for (CellCoord current : path == null ? List.<CellCoord>of() : path) {
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
