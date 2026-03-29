package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.traversal.ResolvedTraversalDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalTopologyProjector {

    private TraversalTopologyProjector() {
        throw new AssertionError("No instances");
    }

    public static TraversalTopology project(
            long mapId,
            List<Room> rooms,
            List<CubePoint> waypointCells,
            Map<Long, ResolvedTraversalDoorBinding> doorBindings,
            Set<CubePoint> obstacles
    ) {
        ProjectedRoomPortals projectedRoomPortals = projectRoomPortalNodes(
                rooms,
                doorBindings == null ? Map.of() : doorBindings);
        List<TraversalNode> waypointNodes = projectWaypointNodes(waypointCells);
        List<TraversalNode> requiredRoomPortalNodes = selectRequiredRoomPortalNodes(projectedRoomPortals.groups(), waypointNodes);
        return new TraversalTopology(
                mapId,
                mergeNodes(projectedRoomPortals.nodes(), waypointNodes),
                mergeRequiredNodeIds(requiredRoomPortalNodes, waypointNodes),
                obstacles == null ? Set.of() : Set.copyOf(obstacles));
    }

    private static ProjectedRoomPortals projectRoomPortalNodes(
            List<Room> rooms,
            Map<Long, ResolvedTraversalDoorBinding> doorBindings
    ) {
        if (rooms == null || rooms.isEmpty()) {
            return ProjectedRoomPortals.empty();
        }
        ArrayList<TraversalNode> nodes = new ArrayList<>();
        ArrayList<RoomPortalGroup> groups = new ArrayList<>();
        int roomIndex = 0;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            ResolvedTraversalDoorBinding fixedDoorBinding = room.roomId() == null
                    ? null
                    : doorBindings.get(room.roomId());
            List<TraversalNode> projectedNodes = fixedDoorBinding == null
                    ? projectUnboundRoomPortalNodes(room, roomIndex)
                    : projectPinnedRoomPortalNodes(room, fixedDoorBinding, roomIndex);
            if (projectedNodes.isEmpty()) {
                projectedNodes = projectUnboundRoomPortalNodes(room, roomIndex);
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
            Room room,
            int roomIndex
    ) {
        Map<Integer, Set<CubePoint>> occupiedCellsByLevel = occupiedCellsByLevel(room);
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (Integer levelZ : sortedRoomLevels(room, occupiedCellsByLevel)) {
            result.add(TraversalNode.roomPortal(
                    TraversalNodeId.roomPortal(room.roomId(), levelZ, roomIndex),
                    room,
                    levelZ,
                    occupiedCellsByLevel.getOrDefault(levelZ, Set.of()),
                    null));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> projectPinnedRoomPortalNodes(
            Room room,
            ResolvedTraversalDoorBinding fixedDoorBinding,
            int roomIndex
    ) {
        Map<Integer, Set<CubePoint>> occupiedCellsByLevel = occupiedCellsByLevel(room);
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (Integer levelZ : sortedRoomLevels(room, occupiedCellsByLevel)) {
            Set<CubePoint> occupiedCells = occupiedCellsByLevel.getOrDefault(levelZ, Set.of());
            if (!supportsFixedDoorBindingAtLevel(occupiedCells, fixedDoorBinding, levelZ)) {
                continue;
            }
            result.add(TraversalNode.roomPortal(
                    TraversalNodeId.roomPortal(room.roomId(), levelZ, roomIndex),
                    room,
                    levelZ,
                    occupiedCells,
                    fixedDoorBinding));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Integer, Set<CubePoint>> occupiedCellsByLevel(Room room) {
        LinkedHashMap<Integer, LinkedHashSet<CubePoint>> byLevel = new LinkedHashMap<>();
        if (room == null || room.cubePoints().isEmpty()) {
            return Map.of();
        }
        for (CubePoint occupiedCell : room.cubePoints()) {
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
            Room room,
            Map<Integer, Set<CubePoint>> occupiedCellsByLevel
    ) {
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        levels.addAll(sortedLevels(room == null ? Set.of() : room.levels()));
        if (levels.isEmpty()) {
            levels.addAll(sortedLevels(occupiedCellsByLevel.keySet()));
        }
        if (levels.isEmpty() && room != null) {
            levels.add(room.primaryLevel());
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
            ResolvedTraversalDoorBinding fixedDoorBinding,
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
        return TraversalPlanningCostModel.approximateConnectionScore(horizontalDistance, verticalDistance);
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
