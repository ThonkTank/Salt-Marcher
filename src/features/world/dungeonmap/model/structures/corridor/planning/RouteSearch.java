package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

final class RouteSearch {

    static final int PATHFINDING_GRID_PADDING = 6;
    static final int MAX_CORNER_PENALTY_TILES = 5;
    static final int MIN_CORNER_PENALTY_TILES = 2;
    static final int CORNER_PENALTY_RELAXATION_INTERVAL = 12;

    private RouteSearch() {
    }

    static List<Point2i> pathThroughPoints(Point2i start, List<Point2i> targets, PlannerContext context) {
        if (start == null || targets == null || targets.isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new java.util.ArrayList<>();
        Point2i current = start;
        for (Point2i target : targets) {
            if (target == null) {
                continue;
            }
            List<Point2i> leg = lowestCostRoute(current, target, context);
            if (leg == null) {
                return List.of();
            }
            if (result.isEmpty()) {
                result.addAll(leg);
            } else if (!leg.isEmpty()) {
                result.addAll(leg.subList(1, leg.size()));
            }
            current = target;
        }
        return List.copyOf(result);
    }

    static List<Point2i> lowestCostRoute(Point2i start, Point2i goal, PlannerContext context) {
        if (goal == null) {
            return null;
        }
        return lowestCostRoute(start, Set.of(goal), context);
    }

    static List<Point2i> lowestCostRoute(Point2i start, Set<Point2i> goals, PlannerContext context) {
        PlannerInstrumentation instrumentation = context == null ? null : context.instrumentation();
        long startedAt = 0L;
        if (instrumentation != null) {
            instrumentation.recordRouteSearchCall();
            startedAt = instrumentation.startTimer();
        }
        try {
            if (start == null || goals == null || goals.isEmpty() || context == null) {
                return null;
            }
            Map<Point2i, Long> roomOccupancy = context.occupancy();
            List<Point2i> goalList = goals.stream()
                    .filter(Objects::nonNull)
                    .filter(goal -> !roomOccupancy.containsKey(goal) || start.equals(goal))
                    .toList();
            if (goalList.isEmpty()) {
                return null;
            }
            if (goalList.contains(start)) {
                return List.of();
            }
            if (roomOccupancy.containsKey(start)) {
                return null;
            }
            PathGrid grid = context.pathfindingSpace().gridFor(start, goalList, PATHFINDING_GRID_PADDING);
            record QueueNode(PathNode node) {}
            PriorityQueue<QueueNode> open = new PriorityQueue<>(Comparator
                    .comparing((QueueNode queueNode) -> queueNode.node().score())
                    .thenComparingInt(queueNode -> distanceToClosestGoal(queueNode.node().state().point(), goalList)));
            // The visit identity is cell + incoming direction only. Distance stays in the score so a slightly longer
            // variant of the same state cannot force arbitrary re-expansion unless it improves the dominant score.
            Map<PathState, RouteCost> bestCostByState = new HashMap<>();
            Map<PathState, PathState> previous = new HashMap<>();
            PathNode startNode = new PathNode(new PathState(start, -1), new RouteCost(0, 0));
            open.add(new QueueNode(startNode));
            bestCostByState.put(startNode.state(), startNode.score());

            PathNode bestGoalNode = null;
            RouteCost bestGoalCost = null;
            while (!open.isEmpty()) {
                PathNode node = open.poll().node();
                RouteCost currentBestCost = bestCostByState.get(node.state());
                if (currentBestCost == null || !currentBestCost.equals(node.score())) {
                    continue;
                }
                if (goalList.contains(node.state().point())) {
                    if (bestGoalCost == null || node.score().compareTo(bestGoalCost) < 0) {
                        bestGoalNode = node;
                        bestGoalCost = node.score();
                    }
                    continue;
                }
                for (int directionIndex = 0; directionIndex < Point2i.CARDINAL_STEPS.size(); directionIndex++) {
                    Point2i next = node.state().point().add(Point2i.CARDINAL_STEPS.get(directionIndex));
                    boolean nextIsGoal = goalList.contains(next);
                    if (!grid.isPassable(next) && !nextIsGoal) {
                        continue;
                    }
                    int nextDistance = node.score().distance() + 1;
                    int nextCorners = node.state().directionIndex() < 0 || node.state().directionIndex() == directionIndex
                            ? node.score().corners()
                            : node.score().corners() + 1;
                    PathState nextState = new PathState(next, directionIndex);
                    RouteCost nextCost = new RouteCost(nextDistance, nextCorners);
                    if (!improves(bestCostByState.get(nextState), nextCost)) {
                        continue;
                    }
                    int optimisticRemainingDistance = distanceToClosestGoal(next, goalList);
                    RouteCost optimisticCost = nextCost.optimisticCompletion(optimisticRemainingDistance);
                    if (bestGoalCost != null && !improves(bestGoalCost, optimisticCost)) {
                        continue;
                    }
                    bestCostByState.put(nextState, nextCost);
                    previous.put(nextState, node.state());
                    open.add(new QueueNode(new PathNode(nextState, nextCost)));
                }
            }
            return bestGoalNode == null ? null : reconstructPath(previous, bestGoalNode.state());
        } finally {
            if (instrumentation != null) {
                instrumentation.recordRouteSearchNanos(System.nanoTime() - startedAt);
            }
        }
    }

    static PathfindingSpace buildPathfindingSpace(Set<Point2i> blocked) {
        if (blocked == null || blocked.isEmpty()) {
            return PathfindingSpace.empty();
        }
        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (Point2i point : blocked) {
            minX = Math.min(minX, point.x());
            maxX = Math.max(maxX, point.x());
            minY = Math.min(minY, point.y());
            maxY = Math.max(maxY, point.y());
        }
        boolean[][] blockedCells = new boolean[maxX - minX + 1][maxY - minY + 1];
        for (Point2i point : blocked) {
            blockedCells[point.x() - minX][point.y() - minY] = true;
        }
        return new PathfindingSpace(minX, minY, maxX, maxY, blockedCells);
    }

    static PathGrid buildPathfindingGrid(PathfindingSpace blockedSpace, Point2i start, Iterable<Point2i> goals, int padding) {
        int minX = start.x() - padding;
        int maxX = start.x() + padding;
        int minY = start.y() - padding;
        int maxY = start.y() + padding;
        for (Point2i goal : goals) {
            minX = Math.min(minX, goal.x() - padding);
            maxX = Math.max(maxX, goal.x() + padding);
            minY = Math.min(minY, goal.y() - padding);
            maxY = Math.max(maxY, goal.y() + padding);
        }
        if (!blockedSpace.isEmpty()) {
            minX = Math.min(minX, blockedSpace.minX() - 2);
            maxX = Math.max(maxX, blockedSpace.maxX() + 2);
            minY = Math.min(minY, blockedSpace.minY() - 2);
            maxY = Math.max(maxY, blockedSpace.maxY() + 2);
        }
        return new PathGrid(minX, minY, maxX, maxY, blockedSpace);
    }

    static RouteCost score(List<Point2i> path) {
        return new RouteCost(pathLength(path), cornerCount(path));
    }

    static int compareRoutePriority(int distance, int corners, int otherDistance, int otherCorners) {
        int valueComparison = Integer.compare(routeValue(distance, corners), routeValue(otherDistance, otherCorners));
        if (valueComparison != 0) {
            return valueComparison;
        }
        int cornerComparison = Integer.compare(corners, otherCorners);
        if (cornerComparison != 0) {
            return cornerComparison;
        }
        return Integer.compare(distance, otherDistance);
    }

    static int routeValue(int distance, int corners) {
        return distance + corners * cornerPenaltyTiles(distance);
    }

    static int cornerPenaltyTiles(int distance) {
        if (distance <= 0) {
            return MAX_CORNER_PENALTY_TILES;
        }
        int relaxedPenalty = MAX_CORNER_PENALTY_TILES - (distance / CORNER_PENALTY_RELAXATION_INTERVAL);
        return Math.max(MIN_CORNER_PENALTY_TILES, relaxedPenalty);
    }

    private static int distanceToClosestGoal(Point2i point, List<Point2i> goals) {
        int best = Integer.MAX_VALUE;
        for (Point2i goal : goals) {
            best = Math.min(best, point.distanceTo(goal));
        }
        return best;
    }

    private static List<Point2i> reconstructPath(Map<PathState, PathState> previous, PathState current) {
        ArrayDeque<Point2i> path = new ArrayDeque<>();
        path.addFirst(current.point());
        while (previous.containsKey(current)) {
            current = previous.get(current);
            path.addFirst(current.point());
        }
        return List.copyOf(path);
    }

    private static int pathLength(List<Point2i> path) {
        return Math.max(0, path == null ? 0 : path.size() - 1);
    }

    private static int cornerCount(List<Point2i> path) {
        if (path == null || path.size() < 3) {
            return 0;
        }
        int corners = 0;
        Point2i previousDirection = path.get(1).subtract(path.get(0));
        for (int index = 2; index < path.size(); index++) {
            Point2i direction = path.get(index).subtract(path.get(index - 1));
            if (!direction.equals(previousDirection)) {
                corners++;
            }
            previousDirection = direction;
        }
        return corners;
    }

    private static boolean improves(RouteCost bestKnownCost, RouteCost candidateCost) {
        return bestKnownCost == null || candidateCost.compareTo(bestKnownCost) < 0;
    }

}

record RouteCost(int distance, int corners) implements Comparable<RouteCost> {
    RouteCost optimisticCompletion(int remainingDistance) {
        return new RouteCost(distance + Math.max(0, remainingDistance), corners);
    }

    @Override
    public int compareTo(RouteCost other) {
        // Each corner must buy enough tile savings to offset its current route-length penalty.
        return RouteSearch.compareRoutePriority(distance, corners, other.distance, other.corners);
    }
}

record PathfindingSpace(int minX, int minY, int maxX, int maxY, boolean[][] blockedCells) {
    static PathfindingSpace empty() {
        return new PathfindingSpace(0, 0, -1, -1, new boolean[0][0]);
    }

    boolean isEmpty() {
        return blockedCells.length == 0;
    }

    boolean isBlocked(Point2i point) {
        if (isEmpty()) {
            return false;
        }
        int x = point.x() - minX;
        int y = point.y() - minY;
        return x >= 0
                && x < blockedCells.length
                && y >= 0
                && y < blockedCells[x].length
                && blockedCells[x][y];
    }

    PathGrid gridFor(Point2i start, Iterable<Point2i> goals, int padding) {
        return RouteSearch.buildPathfindingGrid(this, start, goals, padding);
    }
}

record PathGrid(int minX, int minY, int maxX, int maxY, PathfindingSpace blockedSpace) {
    boolean isPassable(Point2i point) {
        return point.x() >= minX
                && point.x() <= maxX
                && point.y() >= minY
                && point.y() <= maxY
                && !blockedSpace.isBlocked(point);
    }
}

record PathState(Point2i point, int directionIndex) {
}

record PathNode(PathState state, RouteCost score) {
}
