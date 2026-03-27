package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

final class CostField {

    static final List<CubePoint> HORIZONTAL_STEPS = List.of(
            new CubePoint(0, -1, 0),
            new CubePoint(1, 0, 0),
            new CubePoint(0, 1, 0),
            new CubePoint(-1, 0, 0));
    private static final int STAIR_DIRECTION_INDEX = -2;

    private CostField() {
        throw new AssertionError("No instances");
    }

    static ExtractedPath route(PlannerContext context) {
        return extractPathWithStairs(flood(context));
    }

    private static FloodResult flood(PlannerContext context) {
        if (context == null || !context.isRoutable()) {
            return FloodResult.empty();
        }
        PriorityQueue<PathNode> open = new PriorityQueue<>(Comparator.comparing(PathNode::score));
        Map<PathState, RouteCost> best = new HashMap<>();
        Map<PathState, PathState> predecessors = new HashMap<>();
        Map<CubePoint, PathState> bestStateByPoint = new HashMap<>();
        Map<PathState, StairExpansion.StairNeighbor> stairSteps = new HashMap<>();
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
                return new FloodResult(
                        best,
                        predecessors,
                        bestStateByPoint,
                        stairSteps,
                        cell);
            }
            expandHorizontalNeighbors(node, context.searchVolume(), best, predecessors, bestStateByPoint, open);
            expandStairNeighbors(node, context.searchVolume(), best, predecessors, bestStateByPoint, stairSteps, open);
        }
        return new FloodResult(
                best,
                predecessors,
                bestStateByPoint,
                stairSteps,
                null);
    }

    private static ExtractedPath extractPathWithStairs(FloodResult result) {
        if (result == null || result.reachedTarget() == null) {
            return ExtractedPath.empty();
        }
        PathState bestTargetState = result.bestStateAt(result.reachedTarget());
        if (bestTargetState == null) {
            return ExtractedPath.empty();
        }
        ArrayDeque<CubePoint> pathCells = new ArrayDeque<>();
        List<StairTraversal> stairTraversals = new ArrayList<>();
        PathState current = bestTargetState;
        pathCells.addFirst(current.point());
        while (result.predecessors().containsKey(current)) {
            PathState previous = result.predecessors().get(current);
            StairExpansion.StairNeighbor stair = result.stairSteps().get(current);
            if (stair != null && previous != null) {
                List<Integer> exitLevels = new ArrayList<>();
                for (int z = stair.minZ(); z <= stair.maxZ(); z++) {
                    exitLevels.add(z);
                }
                stairTraversals.add(new StairTraversal(
                        previous.point(),
                        current.point(),
                        new StairPlacement(
                                stair.anchor(),
                                stair.shape(),
                                stair.direction(),
                                stair.dimension1(),
                                stair.dimension2(),
                                exitLevels,
                                Set.copyOf(stair.footprint()))));
            }
            current = previous;
            pathCells.addFirst(current.point());
        }
        Collections.reverse(stairTraversals);
        return new ExtractedPath(List.copyOf(pathCells), List.copyOf(stairTraversals));
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
                    null,
                    best,
                    predecessors,
                    bestStateByPoint,
                    null,
                    open);
        }
    }

    private static void expandStairNeighbors(
            PathNode node,
            SearchVolume volume,
            Map<PathState, RouteCost> best,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            Map<PathState, StairExpansion.StairNeighbor> stairSteps,
            PriorityQueue<PathNode> open
    ) {
        CubePoint cell = node.state().point();
        for (StairExpansion.StairNeighbor stairNeighbor : StairExpansion.expand(cell, volume)) {
            if (isOppositeDirection(node.state().directionIndex(), stairNeighbor.entryDirectionIndex())) {
                continue;
            }
            CubePoint exitCell = stairNeighbor.exitCell();
            if (!volume.isPassable(exitCell)) {
                continue;
            }
            int exitDirectionIndex = stairNeighbor.exitDirectionIndex();
            PathState nextState = new PathState(
                    exitCell,
                    STAIR_DIRECTION_INDEX,
                    oppositeDirectionIndex(exitDirectionIndex));
            RouteCost nextCost = new RouteCost(
                    node.score().distance() + stairNeighbor.cost(),
                    node.score().corners(),
                    node.score().levelChanges() + 1);
            relaxState(
                    node.state(),
                    nextState,
                    nextCost,
                    stairNeighbor,
                    best,
                    predecessors,
                    bestStateByPoint,
                    stairSteps,
                    open);
        }
    }

    private static void relaxState(
            PathState previousState,
            PathState nextState,
            RouteCost nextCost,
            StairExpansion.StairNeighbor stairNeighbor,
            Map<PathState, RouteCost> best,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            Map<PathState, StairExpansion.StairNeighbor> stairSteps,
            PriorityQueue<PathNode> open
    ) {
        RouteCost known = best.get(nextState);
        if (known != null && known.compareTo(nextCost) <= 0) {
            return;
        }
        best.put(nextState, nextCost);
        updateBestStateByPoint(bestStateByPoint, best, nextState, nextCost);
        predecessors.put(nextState, previousState);
        if (stairNeighbor != null && stairSteps != null) {
            stairSteps.put(nextState, stairNeighbor);
        }
        open.add(new PathNode(nextState, nextCost));
    }

    private static boolean isOppositeDirection(int firstDirectionIndex, int secondDirectionIndex) {
        return firstDirectionIndex >= 0
                && firstDirectionIndex < 4
                && secondDirectionIndex >= 0
                && secondDirectionIndex < 4
                && oppositeDirectionIndex(firstDirectionIndex) == secondDirectionIndex;
    }

    private static int oppositeDirectionIndex(int directionIndex) {
        if (directionIndex < 0 || directionIndex >= 4) {
            return -1;
        }
        return (directionIndex + 2) % 4;
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
            Map<PathState, StairExpansion.StairNeighbor> stairSteps,
            CubePoint reachedTarget
    ) {
        private FloodResult {
            costs = costs == null ? Map.of() : Map.copyOf(costs);
            predecessors = predecessors == null ? Map.of() : Map.copyOf(predecessors);
            bestStateByPoint = bestStateByPoint == null ? Map.of() : Map.copyOf(bestStateByPoint);
            stairSteps = stairSteps == null ? Map.of() : Map.copyOf(stairSteps);
        }

        private static FloodResult empty() {
            return new FloodResult(Map.of(), Map.of(), Map.of(), Map.of(), null);
        }

        private PathState bestStateAt(CubePoint point) {
            return point == null ? null : bestStateByPoint.get(point);
        }
    }

    record ExtractedPath(
            List<CubePoint> cells,
            List<StairTraversal> stairTraversals
    ) {
        ExtractedPath {
            cells = cells == null ? List.of() : List.copyOf(cells);
            stairTraversals = stairTraversals == null ? List.of() : List.copyOf(stairTraversals);
        }

        static ExtractedPath empty() {
            return new ExtractedPath(List.of(), List.of());
        }

        boolean isEmpty() {
            return cells.isEmpty();
        }

        List<StairPlacement> stairPlacements() {
            if (stairTraversals.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<StairPlacement> result = new LinkedHashSet<>();
            for (StairTraversal stairTraversal : stairTraversals) {
                if (stairTraversal != null && stairTraversal.placement() != null) {
                    result.add(stairTraversal.placement());
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }

    private record StairTraversal(
            CubePoint entryCell,
            CubePoint exitCell,
            StairPlacement placement
    ) {
    }
}
