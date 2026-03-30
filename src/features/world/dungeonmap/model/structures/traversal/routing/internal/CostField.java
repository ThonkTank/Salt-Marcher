package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

final class CostField {

    static final List<CubePoint> HORIZONTAL_STEPS = List.of(
            new CubePoint(0, -1, 0),
            new CubePoint(1, 0, 0),
            new CubePoint(0, 1, 0),
            new CubePoint(-1, 0, 0));

    private CostField() {
        throw new AssertionError("No instances");
    }

    static ExtractedPath route(PlannerContext context) {
        return extractPath(flood(context));
    }

    private static FloodResult flood(PlannerContext context) {
        if (context == null || !context.isRoutable()) {
            return FloodResult.empty();
        }
        PriorityQueue<PathNode> open = new PriorityQueue<>(Comparator.comparing(PathNode::score));
        Map<PathState, RouteCost> best = new HashMap<>();
        Map<PathState, PathState> predecessors = new HashMap<>();
        Map<CubePoint, PathState> bestStateByPoint = new HashMap<>();
        for (CubePoint sourceCell : context.sourceCells()) {
            PathState sourceState = new PathState(sourceCell, context.sourceDirectionIndex(sourceCell), -1);
            RouteCost sourceCost = new RouteCost(0, 0, 0);
            best.put(sourceState, sourceCost);
            bestStateByPoint.put(sourceCell, sourceState);
            open.add(new PathNode(sourceState, sourceCost));
        }
        while (!open.isEmpty()) {
            PathNode node = open.poll();
            if (!node.score().equals(best.get(node.state()))) {
                continue;
            }
            CubePoint cell = node.state().point();
            if (context.targetCells().contains(cell)) {
                return new FloodResult(best, predecessors, bestStateByPoint, cell);
            }
            expandHorizontalNeighbors(node, context.searchVolume(), best, predecessors, bestStateByPoint, open);
        }
        return new FloodResult(best, predecessors, bestStateByPoint, null);
    }

    private static ExtractedPath extractPath(FloodResult result) {
        if (result == null || result.reachedTarget() == null) {
            return ExtractedPath.empty();
        }
        PathState bestTargetState = result.bestStateAt(result.reachedTarget());
        if (bestTargetState == null) {
            return ExtractedPath.empty();
        }
        ArrayDeque<CubePoint> pathCells = new ArrayDeque<>();
        PathState current = bestTargetState;
        pathCells.addFirst(current.point());
        while (result.predecessors().containsKey(current)) {
            current = result.predecessors().get(current);
            pathCells.addFirst(current.point());
        }
        return new ExtractedPath(List.copyOf(pathCells));
    }

    private static void expandHorizontalNeighbors(
            PathNode node,
            SearchVolume volume,
            Map<PathState, RouteCost> best,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            PriorityQueue<PathNode> open
    ) {
        CubePoint cell = node.state().point();
        for (int directionIndex = 0; directionIndex < HORIZONTAL_STEPS.size(); directionIndex++) {
            if (directionIndex == node.state().blockedOppositeDirectionIndex()) {
                continue;
            }
            CubePoint next = cell.add(HORIZONTAL_STEPS.get(directionIndex));
            if (!volume.isPassable(next)) {
                continue;
            }
            int nextCorners = node.score().corners();
            int previousDirection = node.state().directionIndex();
            if (previousDirection >= 0 && previousDirection < 4 && previousDirection != directionIndex) {
                nextCorners++;
            }
            PathState nextState = new PathState(next, directionIndex, -1);
            RouteCost nextCost = new RouteCost(
                    node.score().distance() + 1,
                    nextCorners,
                    node.score().levelChanges());
            relaxState(
                    node.state(),
                    nextState,
                    nextCost,
                    best,
                    predecessors,
                    bestStateByPoint,
                    open);
        }
    }

    private static void relaxState(
            PathState previousState,
            PathState nextState,
            RouteCost nextCost,
            Map<PathState, RouteCost> best,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            PriorityQueue<PathNode> open
    ) {
        RouteCost known = best.get(nextState);
        if (known != null && known.compareTo(nextCost) <= 0) {
            return;
        }
        best.put(nextState, nextCost);
        updateBestStateByPoint(bestStateByPoint, best, nextState, nextCost);
        predecessors.put(nextState, previousState);
        open.add(new PathNode(nextState, nextCost));
    }

    private static void updateBestStateByPoint(
            Map<CubePoint, PathState> bestStateByPoint,
            Map<PathState, RouteCost> best,
            PathState candidateState,
            RouteCost candidateCost
    ) {
        PathState currentBestState = bestStateByPoint.get(candidateState.point());
        if (currentBestState == null) {
            bestStateByPoint.put(candidateState.point(), candidateState);
            return;
        }
        RouteCost currentBestCost = best.get(currentBestState);
        if (currentBestCost == null || candidateCost.compareTo(currentBestCost) < 0) {
            bestStateByPoint.put(candidateState.point(), candidateState);
        }
    }

    private static int compareRoutePriority(
            int distance,
            int corners,
            int levelChanges,
            int otherDistance,
            int otherCorners,
            int otherLevelChanges
    ) {
        int valueComparison = Integer.compare(
                routeValue(distance, corners, levelChanges),
                routeValue(otherDistance, otherCorners, otherLevelChanges));
        if (valueComparison != 0) {
            return valueComparison;
        }
        int levelChangeComparison = Integer.compare(levelChanges, otherLevelChanges);
        if (levelChangeComparison != 0) {
            return levelChangeComparison;
        }
        int cornerComparison = Integer.compare(corners, otherCorners);
        if (cornerComparison != 0) {
            return cornerComparison;
        }
        return Integer.compare(distance, otherDistance);
    }

    private static int routeValue(int distance, int corners, int levelChanges) {
        return distance
                + corners * cornerPenaltyTiles(distance)
                + levelChanges * 10;
    }

    private static int cornerPenaltyTiles(int distance) {
        if (distance <= 0) {
            return 5;
        }
        int relaxedPenalty = 5 - (distance / 12);
        return Math.max(2, relaxedPenalty);
    }

    private record RouteCost(int distance, int corners, int levelChanges) implements Comparable<RouteCost> {
        @Override
        public int compareTo(RouteCost other) {
            return compareRoutePriority(
                    distance,
                    corners,
                    levelChanges,
                    other.distance,
                    other.corners,
                    other.levelChanges);
        }
    }

    private record PathState(CubePoint point, int directionIndex, int blockedOppositeDirectionIndex) {
    }

    private record PathNode(PathState state, RouteCost score) {
    }

    private record FloodResult(
            Map<PathState, RouteCost> costs,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            CubePoint reachedTarget
    ) {
        private FloodResult {
            costs = costs == null ? Map.of() : Map.copyOf(costs);
            predecessors = predecessors == null ? Map.of() : Map.copyOf(predecessors);
            bestStateByPoint = bestStateByPoint == null ? Map.of() : Map.copyOf(bestStateByPoint);
        }

        private static FloodResult empty() {
            return new FloodResult(Map.of(), Map.of(), Map.of(), null);
        }

        private PathState bestStateAt(CubePoint point) {
            return point == null ? null : bestStateByPoint.get(point);
        }
    }

    record ExtractedPath(
            List<CubePoint> cells
    ) {
        ExtractedPath {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        static ExtractedPath empty() {
            return new ExtractedPath(List.of());
        }

        boolean isEmpty() {
            return cells.isEmpty();
        }
    }
}
