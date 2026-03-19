package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

final class CorridorPathfinder {

    // 6 cells cover the widest room radius (rooms are at most 5 cells wide), so any detour around an obstacle stays inside the grid.
    /** Extra grid cells beyond room bounds to allow corridor routing around obstacles. */
    private static final int PATHFINDING_GRID_PADDING = 6;

    private CorridorPathfinder() {
        throw new AssertionError("No instances");
    }

    static List<Point2i> pathThroughPoints(Point2i start, List<Point2i> targets, Map<Point2i, Long> roomOccupancy) {
        if (targets == null || targets.isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        Point2i current = start;
        for (Point2i target : targets) {
            if (target == null) {
                continue;
            }
            if (current.equals(target)) {
                if (result.isEmpty()) {
                    result.add(current);
                }
                continue;
            }
            List<Point2i> leg = shortestPath(current, target, roomOccupancy);
            if (leg.isEmpty()) {
                return List.of();
            }
            if (result.isEmpty()) {
                result.addAll(leg);
            } else {
                result.addAll(leg.subList(1, leg.size()));
            }
            current = target;
        }
        return List.copyOf(result);
    }

    static int pathLength(List<Point2i> path) {
        return Math.max(0, path.size() - 1);
    }

    static int cornerCount(List<Point2i> path) {
        if (path == null || path.size() < 3) {
            return 0;
        }
        int corners = 0;
        Point2i previousDirection = path.get(1).subtract(path.get(0));
        for (int i = 2; i < path.size(); i++) {
            Point2i direction = path.get(i).subtract(path.get(i - 1));
            if (!direction.equals(previousDirection)) {
                corners++;
            }
            previousDirection = direction;
        }
        return corners;
    }

    static int toleratedExtraDistance(int shortestDistance) {
        if (shortestDistance <= 0) {
            return 0;
        }
        // 10%: enough slack for a single direction-change detour without allowing multi-segment detours that produce ugly routes.
        return Math.max(1, (int) Math.ceil(shortestDistance * 0.10d));
    }

    private static List<Point2i> shortestPath(
            Point2i start,
            Point2i goal,
            Map<Point2i, Long> roomOccupancy
    ) {
        if (roomOccupancy.containsKey(start) || roomOccupancy.containsKey(goal)) {
            return List.of();
        }
        PathGrid grid = buildPathfindingGrid(roomOccupancy.keySet(), start, goal, PATHFINDING_GRID_PADDING);

        record QueueNode(PathStep step, int corners) {}
        // Corners before distance: a straight or gently-bent corridor looks better than a short but jagged one.
        PriorityQueue<QueueNode> open = new PriorityQueue<>(Comparator
                .comparingInt(QueueNode::corners)
                .thenComparingInt(node -> node.step().distance())
                .thenComparingInt(node -> node.step().point().distanceTo(goal)));
        Map<PathStep, Integer> bestCornersByStep = new HashMap<>();
        Map<Point2i, Point2i> previous = new HashMap<>();
        PathStep startStep = new PathStep(start, -1, 0);
        open.add(new QueueNode(startStep, 0));
        bestCornersByStep.put(startStep, 0);

        // maxAllowedDistance is set lazily when the goal is first reached; the heuristic distanceTo(goal)
        // is an admissible lower bound so the pruning condition remains valid throughout.
        int maxAllowedDistance = Integer.MAX_VALUE;
        PathStep bestGoalStep = null;
        PathScore bestGoalScore = null;
        while (!open.isEmpty()) {
            QueueNode node = open.poll();
            Integer currentCorners = bestCornersByStep.get(node.step());
            if (currentCorners == null || currentCorners != node.corners()) {
                continue;
            }
            PathScore currentScore = new PathScore(node.step().distance(), node.corners());
            if (node.step().point().equals(goal)) {
                if (bestGoalStep == null) {
                    // First goal reach establishes the shortest reachable distance and the budget cap.
                    int shortestPossibleDistance = node.step().distance();
                    maxAllowedDistance = shortestPossibleDistance + toleratedExtraDistance(shortestPossibleDistance);
                }
                if (bestGoalScore == null || currentScore.compareTo(bestGoalScore) < 0) {
                    bestGoalStep = node.step();
                    bestGoalScore = currentScore;
                }
                continue;
            }
            for (int directionIndex : passableNeighborIndices(node.step().point(), grid)) {
                Point2i next = node.step().point().add(CorridorRouteGeometry.CARDINAL_NEIGHBORS.get(directionIndex));
                int nextDistance = node.step().distance() + 1;
                if (nextDistance > maxAllowedDistance || nextDistance + next.distanceTo(goal) > maxAllowedDistance) {
                    continue;
                }
                int nextCorners = node.step().directionIndex() < 0 || node.step().directionIndex() == directionIndex
                        ? node.corners()
                        : node.corners() + 1;
                PathStep nextStep = new PathStep(next, directionIndex, nextDistance);
                Integer bestKnownCorners = bestCornersByStep.get(nextStep);
                if (bestKnownCorners != null && bestKnownCorners <= nextCorners) {
                    continue;
                }
                bestCornersByStep.put(nextStep, nextCorners);
                previous.put(nextStep.point(), node.step().point());
                open.add(new QueueNode(nextStep, nextCorners));
            }
        }
        return bestGoalStep == null ? List.of() : reconstructPath(previous, bestGoalStep.point());
    }

    /** Returns the direction indices of all passable neighbors of {@code point}. */
    private static int[] passableNeighborIndices(Point2i point, PathGrid grid) {
        int[] buf = new int[CorridorRouteGeometry.CARDINAL_NEIGHBORS.size()];
        int count = 0;
        for (int i = 0; i < CorridorRouteGeometry.CARDINAL_NEIGHBORS.size(); i++) {
            if (grid.isPassable(point.add(CorridorRouteGeometry.CARDINAL_NEIGHBORS.get(i)))) {
                buf[count++] = i;
            }
        }
        return count == buf.length ? buf : Arrays.copyOf(buf, count);
    }

    /**
     * Builds a boolean passability grid covering the bounding box of start, goal, and all blocked
     * cells, extended by {@code padding}. Grid indices are offset by {@code (minX, minY)} — use
     * {@link PathGrid#isPassable} for coordinate-transparent lookups.
     */
    private static PathGrid buildPathfindingGrid(Set<Point2i> blocked, Point2i start, Point2i goal, int padding) {
        int minX = Math.min(start.x(), goal.x()) - padding;
        int maxX = Math.max(start.x(), goal.x()) + padding;
        int minY = Math.min(start.y(), goal.y()) - padding;
        int maxY = Math.max(start.y(), goal.y()) + padding;
        for (Point2i point : blocked) {
            minX = Math.min(minX, point.x() - 2);
            maxX = Math.max(maxX, point.x() + 2);
            minY = Math.min(minY, point.y() - 2);
            maxY = Math.max(maxY, point.y() + 2);
        }
        int width = maxX - minX + 1;
        int height = maxY - minY + 1;
        boolean[][] passable = new boolean[width][height];
        for (boolean[] row : passable) {
            Arrays.fill(row, true);
        }
        for (Point2i p : blocked) {
            int gx = p.x() - minX;
            int gy = p.y() - minY;
            if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
                passable[gx][gy] = false;
            }
        }
        return new PathGrid(minX, minY, passable);
    }

    /** Traces back through {@code cameFrom} from {@code current} and returns the path start-first. */
    private static List<Point2i> reconstructPath(Map<Point2i, Point2i> cameFrom, Point2i current) {
        ArrayDeque<Point2i> path = new ArrayDeque<>();
        path.addFirst(current);
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.addFirst(current);
        }
        return List.copyOf(path);
    }

    private record PathScore(
            int distance,
            int corners
    ) implements Comparable<PathScore> {
        @Override
        public int compareTo(PathScore other) {
            int cornerComparison = Integer.compare(corners, other.corners);
            if (cornerComparison != 0) {
                return cornerComparison;
            }
            return Integer.compare(distance, other.distance);
        }
    }

    /**
     * Precomputed boolean passability grid. World coordinates are translated to grid indices by
     * subtracting {@code (minX, minY)}; use {@link #isPassable} rather than indexing directly.
     */
    private record PathGrid(int minX, int minY, boolean[][] passable) {
        boolean isPassable(Point2i p) {
            int x = p.x() - minX;
            int y = p.y() - minY;
            return x >= 0 && x < passable.length && y >= 0 && y < passable[x].length && passable[x][y];
        }
    }

    private record PathStep(
            Point2i point,
            int directionIndex,
            int distance
    ) {
    }
}
