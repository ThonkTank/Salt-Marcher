package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class StairPathGenerator {

    private StairPathGenerator() {
        throw new AssertionError("No instances");
    }

    public static List<CubePoint> generatePath(
            StairShape shape,
            Point2i anchor,
            StairDirection direction,
            int minZ,
            int maxZ,
            int dimension1,
            int dimension2
    ) {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        StairDirection resolvedDirection = direction == null ? StairDirection.defaultDirection() : direction;
        if (anchor == null) {
            return List.of();
        }
        if (maxZ < minZ) {
            throw new IllegalArgumentException("maxZ darf nicht kleiner als minZ sein");
        }
        int stepCount = maxZ - minZ + 1;
        List<Point2i> projectedPath = switch (resolvedShape) {
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

    private static List<Point2i> ladderPath(Point2i anchor, int stepCount) {
        ArrayList<Point2i> result = new ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(anchor);
        }
        return List.copyOf(result);
    }

    private static List<Point2i> straightPath(Point2i anchor, StairDirection direction, int stepCount) {
        ArrayList<Point2i> result = new ArrayList<>(stepCount);
        Point2i current = anchor;
        result.add(current);
        for (int index = 1; index < stepCount; index++) {
            current = current.add(direction.delta());
            result.add(current);
        }
        return List.copyOf(result);
    }

    private static List<Point2i> spiralPath(
            Point2i anchor,
            StairDirection direction,
            int stepCount,
            int firstSegmentLength,
            int secondSegmentLength
    ) {
        if (firstSegmentLength <= 0 || secondSegmentLength <= 0) {
            throw new IllegalArgumentException("Treppenmaße müssen größer als 0 sein");
        }
        ArrayList<Point2i> result = new ArrayList<>(stepCount);
        Point2i current = anchor;
        StairDirection currentDirection = direction;
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

    private static List<Point2i> circularPath(
            Point2i anchor,
            StairDirection direction,
            int stepCount,
            int radius
    ) {
        if (radius <= 0) {
            throw new IllegalArgumentException("Radius muss größer als 0 sein");
        }
        List<Point2i> loop = circularLoop(anchor, radius);
        if (loop.isEmpty()) {
            throw new IllegalArgumentException("Kreisförmiger Treppenpfad konnte nicht erzeugt werden");
        }
        int startIndex = startIndexForDirection(loop, anchor, direction);
        ArrayList<Point2i> result = new ArrayList<>(stepCount);
        for (int index = 0; index < stepCount; index++) {
            result.add(loop.get((startIndex + index) % loop.size()));
        }
        return List.copyOf(result);
    }

    private static List<Point2i> circularLoop(Point2i anchor, int radius) {
        Set<Point2i> ringPoints = midpointCirclePoints(anchor, radius);
        List<Point2i> ordered = ringPoints.stream()
                .sorted(Comparator
                        .comparingDouble((Point2i point) -> normalizedAngle(anchor, point))
                        .thenComparingInt(Point2i::y)
                        .thenComparingInt(Point2i::x))
                .toList();
        if (ordered.isEmpty()) {
            return List.of();
        }
        ArrayList<Point2i> result = new ArrayList<>();
        for (int index = 0; index < ordered.size(); index++) {
            Point2i current = ordered.get(index);
            Point2i next = ordered.get((index + 1) % ordered.size());
            appendInterpolatedSegment(result, current, next, index == 0);
        }
        return deduplicateSequential(result);
    }

    private static Set<Point2i> midpointCirclePoints(Point2i anchor, int radius) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
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

    private static void addCircleSymmetryPoints(Set<Point2i> points, Point2i anchor, int x, int y) {
        addPoint(points, anchor, x, y);
        addPoint(points, anchor, y, x);
        addPoint(points, anchor, -y, x);
        addPoint(points, anchor, -x, y);
        addPoint(points, anchor, -x, -y);
        addPoint(points, anchor, -y, -x);
        addPoint(points, anchor, y, -x);
        addPoint(points, anchor, x, -y);
    }

    private static void addPoint(Set<Point2i> points, Point2i anchor, int dx, int dy) {
        points.add(new Point2i(anchor.x() + dx, anchor.y() + dy));
    }

    private static double normalizedAngle(Point2i anchor, Point2i point) {
        double angle = Math.atan2(point.y() - anchor.y(), point.x() - anchor.x());
        return angle < 0 ? angle + Math.PI * 2.0 : angle;
    }

    private static int startIndexForDirection(List<Point2i> loop, Point2i anchor, StairDirection direction) {
        Point2i delta = direction.delta();
        double targetAngle = Math.atan2(delta.y(), delta.x());
        if (targetAngle < 0) {
            targetAngle += Math.PI * 2.0;
        }
        int bestIndex = 0;
        double bestScore = Double.MAX_VALUE;
        for (int index = 0; index < loop.size(); index++) {
            Point2i point = loop.get(index);
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

    private static void appendInterpolatedSegment(List<Point2i> points, Point2i start, Point2i end, boolean includeStart) {
        Point2i current = start;
        if (includeStart) {
            points.add(current);
        }
        while (current.x() != end.x()) {
            current = new Point2i(current.x() + Integer.signum(end.x() - current.x()), current.y());
            points.add(current);
        }
        while (current.y() != end.y()) {
            current = new Point2i(current.x(), current.y() + Integer.signum(end.y() - current.y()));
            points.add(current);
        }
    }

    private static List<Point2i> deduplicateSequential(Collection<Point2i> points) {
        ArrayList<Point2i> result = new ArrayList<>();
        Point2i previous = null;
        for (Point2i point : points) {
            if (point != null && !point.equals(previous)) {
                result.add(point);
                previous = point;
            }
        }
        return List.copyOf(result);
    }

    static void validateEdgeConnectivity(List<Point2i> path) {
        Point2i previous = null;
        for (Point2i current : path == null ? List.<Point2i>of() : path) {
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
