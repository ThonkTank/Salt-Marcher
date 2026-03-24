package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

final class CostField {

    static final List<CubePoint> STEPS = List.of(
            new CubePoint(0, -1, 0),
            new CubePoint(1, 0, 0),
            new CubePoint(0, 1, 0),
            new CubePoint(-1, 0, 0),
            new CubePoint(0, 0, 1),
            new CubePoint(0, 0, -1));
    static final int VIA_COST = 4;

    private CostField() {
    }

    static FloodResult flood(
            Map<PathState, RouteCost> sources,
            SearchVolume volume,
            Set<CubePoint> targetEntryCells,
            PlannerInstrumentation instrumentation
    ) {
        long startedAt = instrumentation == null ? 0L : instrumentation.startTimer();
        if (instrumentation != null) {
            instrumentation.recordFloodCall();
        }
        try {
            if (sources == null || sources.isEmpty() || volume == null || targetEntryCells == null || targetEntryCells.isEmpty()) {
                return new FloodResult(Map.of(), Map.of(), Set.of(), Map.of());
            }
            PriorityQueue<PathNode> open = new PriorityQueue<>(Comparator.comparing(PathNode::score));
            Map<PathState, RouteCost> best = new HashMap<>();
            Map<PathState, PathState> predecessors = new HashMap<>();
            Map<CubePoint, PathState> bestStateByPoint = new HashMap<>();
            for (Map.Entry<PathState, RouteCost> entry : sources.entrySet()) {
                if (entry.getKey() == null || entry.getKey().point() == null || entry.getValue() == null) {
                    continue;
                }
                RouteCost known = best.get(entry.getKey());
                if (known == null || entry.getValue().compareTo(known) < 0) {
                    best.put(entry.getKey(), entry.getValue());
                    updateBestStateByPoint(bestStateByPoint, best, entry.getKey(), entry.getValue());
                    open.add(new PathNode(entry.getKey(), entry.getValue()));
                }
            }
            Set<CubePoint> reached = new LinkedHashSet<>();
            while (!open.isEmpty()) {
                PathNode node = open.poll();
                if (!node.score().equals(best.get(node.state()))) {
                    continue;
                }
                CubePoint cell = node.state().point();
                if (targetEntryCells.contains(cell)) {
                    reached.add(cell);
                    continue;
                }
                for (int directionIndex = 0; directionIndex < STEPS.size(); directionIndex++) {
                    CubePoint next = cell.add(STEPS.get(directionIndex));
                    if (!volume.isPassable(next) && !targetEntryCells.contains(next)) {
                        continue;
                    }
                    boolean vertical = directionIndex >= 4;
                    int nextDistance = node.score().distance() + (vertical ? VIA_COST : 1);
                    int nextCorners = node.score().corners();
                    int previousDirection = node.state().directionIndex();
                    if (!vertical && previousDirection >= 0 && previousDirection < 4 && previousDirection != directionIndex) {
                        nextCorners++;
                    }
                    PathState nextState = new PathState(next, directionIndex);
                    RouteCost nextCost = new RouteCost(nextDistance, nextCorners);
                    RouteCost known = best.get(nextState);
                    if (known != null && known.compareTo(nextCost) <= 0) {
                        continue;
                    }
                    best.put(nextState, nextCost);
                    updateBestStateByPoint(bestStateByPoint, best, nextState, nextCost);
                    predecessors.put(nextState, node.state());
                    open.add(new PathNode(nextState, nextCost));
                }
            }
            return new FloodResult(
                    Map.copyOf(best),
                    Map.copyOf(predecessors),
                    Set.copyOf(reached),
                    Map.copyOf(bestStateByPoint));
        } finally {
            if (instrumentation != null) {
                instrumentation.recordFloodNanos(System.nanoTime() - startedAt);
            }
        }
    }

    static List<CubePoint> extractPath(FloodResult result, CubePoint target) {
        if (result == null || target == null) {
            return List.of();
        }
        PathState bestTargetState = result.bestStateAt(target);
        if (bestTargetState == null) {
            return List.of();
        }
        ArrayDeque<CubePoint> path = new ArrayDeque<>();
        PathState current = bestTargetState;
        path.addFirst(current.point());
        while (result.predecessors().containsKey(current)) {
            current = result.predecessors().get(current);
            path.addFirst(current.point());
        }
        return List.copyOf(path);
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
}

record FloodResult(
        Map<PathState, RouteCost> costs,
        Map<PathState, PathState> predecessors,
        Set<CubePoint> reachedTargets,
        Map<CubePoint, PathState> bestStateByPoint
) {
    RouteCost bestCostAt(CubePoint point) {
        PathState state = bestStateAt(point);
        return state == null ? null : costs.get(state);
    }

    PathState bestStateAt(CubePoint point) {
        return point == null ? null : bestStateByPoint.get(point);
    }
}
