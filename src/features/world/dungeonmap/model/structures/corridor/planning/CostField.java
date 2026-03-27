package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;

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
    static final List<CubePoint> STEPS = List.of(
            new CubePoint(0, -1, 0),
            new CubePoint(1, 0, 0),
            new CubePoint(0, 1, 0),
            new CubePoint(-1, 0, 0),
            new CubePoint(0, 0, 1),
            new CubePoint(0, 0, -1));
    static final int STAIR_DIRECTION_INDEX = -2;

    private CostField() {
    }

    static FloodResult flood(
            Map<PathState, RouteCost> sources,
            SearchVolume volume,
            Set<CubePoint> targetEntryCells,
            Map<CubePoint, Long> targetRoomByEntryCell,
            PlannerInstrumentation instrumentation
    ) {
        return floodInternal(sources, volume, targetEntryCells, targetRoomByEntryCell, instrumentation, true);
    }

    static FloodResult floodFull(
            Map<PathState, RouteCost> sources,
            SearchVolume volume,
            PlannerInstrumentation instrumentation
    ) {
        return floodInternal(sources, volume, Set.of(), Map.of(), instrumentation, false);
    }

    private static FloodResult floodInternal(
            Map<PathState, RouteCost> sources,
            SearchVolume volume,
            Set<CubePoint> targetEntryCells,
            Map<CubePoint, Long> targetRoomByEntryCell,
            PlannerInstrumentation instrumentation,
            boolean stopWhenTargetsReached
    ) {
        long startedAt = instrumentation == null ? 0L : instrumentation.startTimer();
        if (instrumentation != null) {
            instrumentation.recordFloodCall();
        }
        try {
            if (sources == null || sources.isEmpty() || volume == null) {
                return new FloodResult(Map.of(), Map.of(), Set.of(), Map.of(), Map.of());
            }
            Set<CubePoint> targets = targetEntryCells == null ? Set.of() : targetEntryCells;
            Map<CubePoint, Long> roomsByEntry = targetRoomByEntryCell == null ? Map.of() : targetRoomByEntryCell;
            if (stopWhenTargetsReached && targets.isEmpty()) {
                return new FloodResult(Map.of(), Map.of(), Set.of(), Map.of(), Map.of());
            }
            PriorityQueue<PathNode> open = new PriorityQueue<>(Comparator.comparing(PathNode::score));
            Map<PathState, RouteCost> best = new HashMap<>();
            Map<PathState, PathState> predecessors = new HashMap<>();
            Map<CubePoint, PathState> bestStateByPoint = new HashMap<>();
            Map<PathState, StairNeighbor> stairSteps = new HashMap<>();
            Set<Long> reachedRoomIds = new LinkedHashSet<>();
            int expectedRoomCount = targetRoomCount(roomsByEntry);
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
                if (targets.contains(cell)) {
                    reached.add(cell);
                    Long roomId = roomsByEntry.get(cell);
                    if (roomId != null) {
                        reachedRoomIds.add(roomId);
                    }
                    if (stopWhenTargetsReached && expectedRoomCount > 0 && reachedRoomIds.size() >= expectedRoomCount) {
                        break;
                    }
                    continue;
                }
                expandHorizontalNeighbors(node, volume, targets, best, predecessors, bestStateByPoint, open);
                expandStairNeighbors(node, volume, targets, best, predecessors, bestStateByPoint, stairSteps, open);
            }
            return new FloodResult(
                    best,
                    predecessors,
                    reached,
                    bestStateByPoint,
                    Map.copyOf(stairSteps));
        } finally {
            if (instrumentation != null) {
                instrumentation.recordFloodNanos(System.nanoTime() - startedAt);
            }
        }
    }

    private static void expandHorizontalNeighbors(
            PathNode node,
            SearchVolume volume,
            Set<CubePoint> targets,
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
            if (!volume.isPassable(next) && !targets.contains(next)) {
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
            Set<CubePoint> targets,
            Map<PathState, RouteCost> best,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            Map<PathState, StairNeighbor> stairSteps,
            PriorityQueue<PathNode> open
    ) {
        CubePoint cell = node.state().point();
        for (StairNeighbor stairNeighbor : StairExpansion.expand(cell, volume, Set.of())) {
            if (isOppositeDirection(node.state().directionIndex(), stairNeighbor.entryDirectionIndex())) {
                continue;
            }
            CubePoint exitCell = stairNeighbor.exitCell();
            if (!volume.isPassable(exitCell) && !targets.contains(exitCell)) {
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
            StairNeighbor stairNeighbor,
            Map<PathState, RouteCost> best,
            Map<PathState, PathState> predecessors,
            Map<CubePoint, PathState> bestStateByPoint,
            Map<PathState, StairNeighbor> stairSteps,
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

    static ExtractedPath extractPathWithStairs(FloodResult result, CubePoint target) {
        if (result == null || target == null) {
            return ExtractedPath.empty();
        }
        PathState bestTargetState = result.bestStateAt(target);
        if (bestTargetState == null) {
            return ExtractedPath.empty();
        }
        ArrayDeque<CubePoint> pathCells = new ArrayDeque<>();
        List<StairPlacement> placements = new ArrayList<>();
        PathState current = bestTargetState;
        pathCells.addFirst(current.point());
        while (result.predecessors().containsKey(current)) {
            StairNeighbor stair = result.stairSteps().get(current);
            if (stair != null) {
                for (CubePoint footprintCell : stair.footprint()) {
                    if (!footprintCell.equals(current.point())) {
                        pathCells.addFirst(footprintCell);
                    }
                }
                List<Integer> exitLevels = new ArrayList<>();
                for (int z = stair.minZ(); z <= stair.maxZ(); z++) {
                    exitLevels.add(z);
                }
                placements.add(new StairPlacement(
                        stair.anchor(),
                        stair.shape(),
                        stair.direction(),
                        stair.dimension1(),
                        stair.dimension2(),
                        exitLevels,
                        Set.copyOf(stair.footprint())));
            }
            current = result.predecessors().get(current);
            pathCells.addFirst(current.point());
        }
        Collections.reverse(placements);
        return new ExtractedPath(List.copyOf(pathCells), StairPlacement.canonicalize(placements));
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

    private static int targetRoomCount(Map<CubePoint, Long> targetRoomByEntryCell) {
        if (targetRoomByEntryCell == null || targetRoomByEntryCell.isEmpty()) {
            return 0;
        }
        return new LinkedHashSet<>(targetRoomByEntryCell.values()).size();
    }
}

record FloodResult(
        Map<PathState, RouteCost> costs,
        Map<PathState, PathState> predecessors,
        Set<CubePoint> reachedTargets,
        Map<CubePoint, PathState> bestStateByPoint,
        Map<PathState, StairNeighbor> stairSteps
) {
    RouteCost bestCostAt(CubePoint point) {
        PathState state = bestStateAt(point);
        return state == null ? null : costs.get(state);
    }

    PathState bestStateAt(CubePoint point) {
        return point == null ? null : bestStateByPoint.get(point);
    }
}
