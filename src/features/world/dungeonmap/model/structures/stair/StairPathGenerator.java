package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class StairPathGenerator {

    private StairPathGenerator() {
        throw new AssertionError("No instances");
    }

    public static List<CubePoint> generatePath(
            StairShape shape,
            CellCoord anchor,
            CardinalDirection direction,
            int minZ,
            int maxZ,
            int dimension1,
            int dimension2
    ) {
        // This helper may generate a whole-stair replacement path for editor/application workflows,
        // but the generated path itself is the only domain truth that may be persisted.
        StairShape resolvedShape = Objects.requireNonNull(shape, "shape");
        CardinalDirection resolvedDirection = Objects.requireNonNull(direction, "direction");
        if (anchor == null) {
            return List.of();
        }
        if (maxZ < minZ) {
            throw new IllegalArgumentException("maxZ darf nicht kleiner als minZ sein");
        }
        String validationMessage = resolvedShape.validateDimensions(dimension1, dimension2).orElse(null);
        if (validationMessage != null) {
            throw new IllegalArgumentException(validationMessage);
        }
        int stepCount = maxZ - minZ + 1;
        List<CellCoord> projectedPath = switch (resolvedShape) {
            case LADDER -> ladderPath(anchor, stepCount);
            case STRAIGHT -> straightPath(anchor, resolvedDirection, stepCount);
            case SQUARE -> spiralPath(anchor, resolvedDirection, stepCount, dimension1, dimension1);
            case RECTANGULAR -> spiralPath(anchor, resolvedDirection, stepCount, dimension1, dimension2);
            case CIRCULAR -> circularPath(anchor, resolvedDirection, stepCount, dimension1);
        };
        validateEdgeConnectivity(projectedPath);
        ArrayList<CubePoint> result = new ArrayList<>(projectedPath.size());
        for (int index = 0; index < projectedPath.size(); index++) {
            result.add(CubePoint.at(projectedPath.get(index), minZ + index));
        }
        return List.copyOf(result);
    }

    private static List<CellCoord> ladderPath(CellCoord anchor, int stepCount) {
        ArrayList<CellCoord> result = new ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(anchor);
        }
        return List.copyOf(result);
    }

    private static List<CellCoord> straightPath(CellCoord anchor, CardinalDirection direction, int stepCount) {
        ArrayList<CellCoord> result = new ArrayList<>(stepCount);
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
        ArrayList<CellCoord> result = new ArrayList<>(stepCount);
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
            throw new IllegalArgumentException("Kreisförmiger Treppenpfad konnte nicht erzeugt werden");
        }
        int startIndex = startIndexForDirection(loop, anchor, direction);
        ArrayList<CellCoord> result = new ArrayList<>(stepCount);
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
        ArrayList<CellCoord> result = new ArrayList<>();
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
        ArrayList<CellCoord> result = new ArrayList<>();
        CellCoord previous = null;
        for (CellCoord point : points) {
            if (point != null && !point.equals(previous)) {
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
                throw new IllegalArgumentException("Treppenpfad darf keine Null-Zellen enthalten");
            }
            if (previous != null) {
                int deltaX = Math.abs(current.x() - previous.x());
                int deltaY = Math.abs(current.y() - previous.y());
                if (deltaX + deltaY > 1) {
                    throw new IllegalArgumentException("Treppenpfad verletzt die Kantenverbindung");
                }
            }
            previous = current;
        }
    }
}
