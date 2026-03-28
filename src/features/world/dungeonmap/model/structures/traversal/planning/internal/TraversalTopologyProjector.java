package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanRequest;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalTopologyProjector {

    private static final long VERTICAL_SCORE_WEIGHT = 1_000L;

    private TraversalTopologyProjector() {
        throw new AssertionError("No instances");
    }

    public static TraversalTopology project(TraversalPlanRequest request) {
        if (request == null) {
            return TraversalTopology.empty();
        }
        ProjectedRoomPortals projectedRoomPortals = projectRoomPortalNodes(request.roomAnchors(), request.doorBindings());
        List<TraversalNode> waypointNodes = projectWaypointNodes(request.waypointCells());
        List<TraversalNode> requiredRoomPortalNodes = selectRequiredRoomPortalNodes(projectedRoomPortals.groups(), waypointNodes);
        return new TraversalTopology(
                request.corridorId(),
                request.mapId(),
                mergeNodes(projectedRoomPortals.nodes(), waypointNodes),
                List.of(),
                mergeRequiredNodeIds(requiredRoomPortalNodes, waypointNodes),
                request.obstacles());
    }

    private static ProjectedRoomPortals projectRoomPortalNodes(
            List<TraversalRoomAnchor> roomAnchors,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings
    ) {
        if (roomAnchors == null || roomAnchors.isEmpty()) {
            return ProjectedRoomPortals.empty();
        }
        ArrayList<TraversalNode> nodes = new ArrayList<>();
        ArrayList<RoomPortalGroup> groups = new ArrayList<>();
        int roomIndex = 0;
        for (TraversalRoomAnchor roomAnchor : roomAnchors) {
            if (roomAnchor == null) {
                continue;
            }
            ResolvedCorridorDoorBinding fixedDoorBinding = roomAnchor.roomId() == null
                    ? null
                    : doorBindings.get(roomAnchor.roomId());
            List<TraversalNode> projectedNodes = fixedDoorBinding == null
                    ? projectUnboundRoomPortalNodes(roomAnchor, roomIndex)
                    : projectPinnedRoomPortalNodes(roomAnchor, fixedDoorBinding, roomIndex);
            if (projectedNodes.isEmpty()) {
                projectedNodes = projectUnboundRoomPortalNodes(roomAnchor, roomIndex);
            }
            if (projectedNodes.isEmpty()) {
                roomIndex++;
                continue;
            }
            nodes.addAll(projectedNodes);
            groups.add(new RoomPortalGroup(projectedNodes));
            roomIndex++;
        }
        return new ProjectedRoomPortals(nodes, groups);
    }

    private static List<TraversalNode> projectWaypointNodes(List<CubePoint> waypointCells) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (CubePoint waypointCell : waypointCells) {
            if (waypointCell == null) {
                continue;
            }
            result.add(TraversalNode.waypoint(TraversalNodeId.waypoint(result.size()), waypointCell));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> mergeNodes(
            List<TraversalNode> roomPortalNodes,
            List<TraversalNode> waypointNodes
    ) {
        ArrayList<TraversalNode> result = new ArrayList<>();
        if (roomPortalNodes != null) {
            result.addAll(roomPortalNodes);
        }
        if (waypointNodes != null) {
            result.addAll(waypointNodes);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNodeId> mergeRequiredNodeIds(
            List<TraversalNode> requiredRoomPortalNodes,
            List<TraversalNode> waypointNodes
    ) {
        LinkedHashSet<TraversalNodeId> result = new LinkedHashSet<>();
        for (TraversalNode requiredRoomPortalNode : requiredRoomPortalNodes == null
                ? List.<TraversalNode>of()
                : requiredRoomPortalNodes) {
            if (requiredRoomPortalNode != null && requiredRoomPortalNode.nodeId() != null) {
                result.add(requiredRoomPortalNode.nodeId());
            }
        }
        for (TraversalNode waypointNode : waypointNodes == null ? List.<TraversalNode>of() : waypointNodes) {
            if (waypointNode != null && waypointNode.nodeId() != null) {
                result.add(waypointNode.nodeId());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> projectUnboundRoomPortalNodes(
            TraversalRoomAnchor roomAnchor,
            int roomIndex
    ) {
        Map<Integer, Set<CubePoint>> occupiedCellsByLevel = occupiedCellsByLevel(roomAnchor);
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (Integer levelZ : sortedRoomLevels(roomAnchor, occupiedCellsByLevel)) {
            result.add(TraversalNode.roomPortal(
                    TraversalNodeId.roomPortal(roomAnchor.roomId(), levelZ, roomIndex),
                    roomAnchor,
                    levelZ,
                    occupiedCellsByLevel.getOrDefault(levelZ, Set.of()),
                    null));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> projectPinnedRoomPortalNodes(
            TraversalRoomAnchor roomAnchor,
            ResolvedCorridorDoorBinding fixedDoorBinding,
            int roomIndex
    ) {
        Map<Integer, Set<CubePoint>> occupiedCellsByLevel = occupiedCellsByLevel(roomAnchor);
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (Integer levelZ : sortedRoomLevels(roomAnchor, occupiedCellsByLevel)) {
            Set<CubePoint> occupiedCells = occupiedCellsByLevel.getOrDefault(levelZ, Set.of());
            if (!supportsFixedDoorBindingAtLevel(occupiedCells, fixedDoorBinding, levelZ)) {
                continue;
            }
            result.add(TraversalNode.roomPortal(
                    TraversalNodeId.roomPortal(roomAnchor.roomId(), levelZ, roomIndex),
                    roomAnchor,
                    levelZ,
                    occupiedCells,
                    fixedDoorBinding));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Integer, Set<CubePoint>> occupiedCellsByLevel(TraversalRoomAnchor roomAnchor) {
        LinkedHashMap<Integer, LinkedHashSet<CubePoint>> byLevel = new LinkedHashMap<>();
        if (roomAnchor == null || roomAnchor.occupiedCells().isEmpty()) {
            return Map.of();
        }
        for (CubePoint occupiedCell : roomAnchor.occupiedCells()) {
            if (occupiedCell == null) {
                continue;
            }
            byLevel.computeIfAbsent(occupiedCell.z(), ignored -> new LinkedHashSet<>()).add(occupiedCell);
        }
        if (byLevel.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Integer, Set<CubePoint>> result = new LinkedHashMap<>();
        for (Integer levelZ : sortedLevels(byLevel.keySet())) {
            result.put(levelZ, Set.copyOf(byLevel.get(levelZ)));
        }
        return Map.copyOf(result);
    }

    private static List<Integer> sortedRoomLevels(
            TraversalRoomAnchor roomAnchor,
            Map<Integer, Set<CubePoint>> occupiedCellsByLevel
    ) {
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        levels.addAll(sortedLevels(roomAnchor == null ? Set.of() : roomAnchor.levels()));
        if (levels.isEmpty()) {
            levels.addAll(sortedLevels(occupiedCellsByLevel.keySet()));
        }
        if (levels.isEmpty() && roomAnchor != null) {
            levels.add(roomAnchor.primaryLevel());
        }
        return levels.isEmpty() ? List.of() : List.copyOf(levels);
    }

    private static List<Integer> sortedLevels(Set<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                result.add(level);
            }
        }
        result.sort(Comparator.naturalOrder());
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static boolean supportsFixedDoorBindingAtLevel(
            Set<CubePoint> occupiedCells,
            ResolvedCorridorDoorBinding fixedDoorBinding,
            int levelZ
    ) {
        if (occupiedCells == null
                || occupiedCells.isEmpty()
                || fixedDoorBinding == null
                || fixedDoorBinding.absoluteCell() == null
                || fixedDoorBinding.direction() == null) {
            return false;
        }
        CubePoint boundRoomCell = CubePoint.at(fixedDoorBinding.absoluteCell(), levelZ);
        CubePoint boundEntryCell = CubePoint.at(
                fixedDoorBinding.absoluteCell().add(fixedDoorBinding.direction()),
                levelZ);
        return occupiedCells.contains(boundRoomCell) && !occupiedCells.contains(boundEntryCell);
    }

    private static List<TraversalNode> selectRequiredRoomPortalNodes(
            List<RoomPortalGroup> groups,
            List<TraversalNode> waypointNodes
    ) {
        if (groups == null || groups.isEmpty()) {
            return List.of();
        }
        if (waypointNodes != null && !waypointNodes.isEmpty()) {
            return selectRoomPortalsForWaypointBackbone(groups, waypointNodes);
        }
        return selectRoomPortalsForRoomBackbone(groups);
    }

    private static List<TraversalNode> selectRoomPortalsForWaypointBackbone(
            List<RoomPortalGroup> groups,
            List<TraversalNode> waypointNodes
    ) {
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (RoomPortalGroup group : groups) {
            TraversalNode selectedNode = selectClosestNode(group.nodes(), waypointNodes);
            if (selectedNode != null) {
                result.add(selectedNode);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static TraversalNode selectClosestNode(
            List<TraversalNode> candidates,
            List<TraversalNode> referenceNodes
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        TraversalNode best = null;
        long bestScore = Long.MAX_VALUE;
        for (TraversalNode candidate : candidates) {
            long candidateScore = nearestReferenceScore(candidate, referenceNodes);
            if (candidateScore < bestScore) {
                best = candidate;
                bestScore = candidateScore;
            }
        }
        return best;
    }

    private static List<TraversalNode> selectRoomPortalsForRoomBackbone(List<RoomPortalGroup> groups) {
        ArrayList<List<TraversalNode>> candidatesByRoom = new ArrayList<>();
        for (RoomPortalGroup group : groups) {
            if (group == null || group.nodes().isEmpty()) {
                return List.of();
            }
            candidatesByRoom.add(group.nodes());
        }
        if (candidatesByRoom.isEmpty()) {
            return List.of();
        }
        ArrayList<long[]> costsByRoom = new ArrayList<>();
        ArrayList<int[]> previousChoiceByRoom = new ArrayList<>();
        for (int roomIndex = 0; roomIndex < candidatesByRoom.size(); roomIndex++) {
            List<TraversalNode> candidates = candidatesByRoom.get(roomIndex);
            long[] costs = new long[candidates.size()];
            int[] previousChoices = new int[candidates.size()];
            for (int candidateIndex = 0; candidateIndex < candidates.size(); candidateIndex++) {
                costs[candidateIndex] = roomIndex == 0 ? 0L : Long.MAX_VALUE;
                previousChoices[candidateIndex] = -1;
                if (roomIndex == 0) {
                    continue;
                }
                List<TraversalNode> previousCandidates = candidatesByRoom.get(roomIndex - 1);
                long bestCost = Long.MAX_VALUE;
                int bestPreviousChoice = -1;
                for (int previousIndex = 0; previousIndex < previousCandidates.size(); previousIndex++) {
                    long previousCost = costsByRoom.get(roomIndex - 1)[previousIndex];
                    if (previousCost == Long.MAX_VALUE) {
                        continue;
                    }
                    long candidateCost = previousCost + connectionScore(previousCandidates.get(previousIndex), candidates.get(candidateIndex));
                    if (candidateCost < bestCost) {
                        bestCost = candidateCost;
                        bestPreviousChoice = previousIndex;
                    }
                }
                costs[candidateIndex] = bestCost;
                previousChoices[candidateIndex] = bestPreviousChoice;
            }
            costsByRoom.add(costs);
            previousChoiceByRoom.add(previousChoices);
        }
        long[] finalCosts = costsByRoom.getLast();
        int bestFinalChoice = 0;
        for (int candidateIndex = 1; candidateIndex < finalCosts.length; candidateIndex++) {
            if (finalCosts[candidateIndex] < finalCosts[bestFinalChoice]) {
                bestFinalChoice = candidateIndex;
            }
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (int roomIndex = candidatesByRoom.size() - 1; roomIndex >= 0; roomIndex--) {
            List<TraversalNode> candidates = candidatesByRoom.get(roomIndex);
            result.addFirst(candidates.get(bestFinalChoice));
            if (roomIndex > 0) {
                bestFinalChoice = previousChoiceByRoom.get(roomIndex)[bestFinalChoice];
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static long nearestReferenceScore(
            TraversalNode candidate,
            List<TraversalNode> referenceNodes
    ) {
        if (candidate == null || referenceNodes == null || referenceNodes.isEmpty()) {
            return Long.MAX_VALUE;
        }
        long bestScore = Long.MAX_VALUE;
        for (TraversalNode referenceNode : referenceNodes) {
            bestScore = Math.min(bestScore, connectionScore(candidate, referenceNode));
        }
        return bestScore;
    }

    private static long connectionScore(TraversalNode first, TraversalNode second) {
        if (first == null || second == null || first.anchor() == null || second.anchor() == null) {
            return Long.MAX_VALUE;
        }
        long verticalDistance = Math.abs(first.levelZ() - second.levelZ());
        long horizontalDistance = Math.abs((long) first.anchor().x() - second.anchor().x())
                + Math.abs((long) first.anchor().y() - second.anchor().y());
        return verticalDistance * VERTICAL_SCORE_WEIGHT + horizontalDistance;
    }

    private record ProjectedRoomPortals(
            List<TraversalNode> nodes,
            List<RoomPortalGroup> groups
    ) {
        private ProjectedRoomPortals {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
            groups = groups == null ? List.of() : List.copyOf(groups);
        }

        private static ProjectedRoomPortals empty() {
            return new ProjectedRoomPortals(List.of(), List.of());
        }
    }

    private record RoomPortalGroup(
            List<TraversalNode> nodes
    ) {
        private RoomPortalGroup {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
        }
    }
}
