package features.world.dungeon.dungeonmap.corridor.application;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorDraft;
import features.world.dungeon.dungeonmap.corridor.model.CorridorMember;
import features.world.dungeon.dungeonmap.corridor.model.CorridorNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorPathTrace;
import features.world.dungeon.dungeonmap.corridor.model.CorridorResolutionInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSegment;
import features.world.dungeon.dungeonmap.corridor.model.CorridorTerminal;
import features.world.dungeon.dungeonmap.corridor.model.CorridorWaypoint;
import features.world.dungeon.dungeonmap.model.CorridorResolutionRequest;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class CorridorDraftPlanner {

    private CorridorDraftPlanner() {
        throw new AssertionError("No instances");
    }

    public static CorridorDraftPlan plan(
            Corridor corridor,
            CorridorTopologyEdit edit,
            CorridorResolutionInput input
    ) {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        if (edit == null) {
            return CorridorDraftPlan.unchanged();
        }
        Set<Long> removedNodeIds = new LinkedHashSet<>();
        Set<SegmentKey> removedSegments = new LinkedHashSet<>();
        switch (edit) {
            case CorridorTopologyEdit.DeleteWaypoint deleteWaypoint -> removedNodeIds.add(requiredWaypointNodeId(resolvedCorridor, deleteWaypoint.waypointId()));
            case CorridorTopologyEdit.DeleteSegment deleteSegment -> removedSegments.add(requiredSegmentKey(resolvedCorridor, deleteSegment.memberId(), deleteSegment.segmentOrdinal()));
            case CorridorTopologyEdit.DeleteDoor deleteDoor -> removedNodeIds.add(requiredDoorNodeId(resolvedCorridor, deleteDoor.boundarySegment(), input));
        }
        List<CorridorSegment> remainingSegments = remainingSegments(resolvedCorridor.segments(), removedNodeIds, removedSegments);
        if (remainingSegments.size() == resolvedCorridor.segments().size() && removedNodeIds.isEmpty()) {
            return CorridorDraftPlan.unchanged();
        }
        List<Component> components = components(resolvedCorridor, remainingSegments);
        if (components.isEmpty()) {
            return new CorridorDraftPlan(true, List.of());
        }
        components = components.stream()
                .sorted(Comparator
                        .comparingInt((Component component) -> component.segments().size())
                        .thenComparingInt(component -> component.nodeIds().size())
                        .reversed())
                .toList();
        ArrayList<CorridorResolutionRequest> requests = new ArrayList<>(components.size());
        boolean first = true;
        for (Component component : components) {
            CorridorDraft draft = draftForComponent(resolvedCorridor, component, first);
            requests.add(new CorridorResolutionRequest(draft, componentDoors(resolvedCorridor, component.segmentKeys())));
            first = false;
        }
        return new CorridorDraftPlan(true, requests);
    }

    private static long requiredWaypointNodeId(Corridor corridor, Long waypointId) {
        CorridorWaypoint waypoint = corridor.waypoints().stream()
                .filter(candidate -> Objects.equals(candidate.waypointId(), waypointId))
                .findFirst()
                .orElse(null);
        if (waypoint == null || waypoint.waypointId() == null) {
            throw new IllegalArgumentException("Unknown corridor waypoint " + waypointId);
        }
        return waypoint.waypointId();
    }

    private static SegmentKey requiredSegmentKey(Corridor corridor, Long memberId, int segmentOrdinal) {
        CorridorSegment segment = corridor.segments().stream()
                .filter(candidate -> Objects.equals(candidate.memberId(), memberId) && candidate.segmentOrdinal() == segmentOrdinal)
                .findFirst()
                .orElse(null);
        if (segment == null) {
            throw new IllegalArgumentException("Unknown corridor segment " + memberId + ":" + segmentOrdinal);
        }
        return SegmentKey.of(segment);
    }

    private static long requiredDoorNodeId(Corridor corridor, GridSegment boundarySegment, CorridorResolutionInput input) {
        CorridorNode node = corridor.doorNodeAtBoundary(boundarySegment, input);
        if (node == null || node.nodeId() == null) {
            throw new IllegalArgumentException("Unknown corridor door boundary " + boundarySegment);
        }
        return node.nodeId();
    }

    private static List<CorridorSegment> remainingSegments(
            List<CorridorSegment> segments,
            Set<Long> removedNodeIds,
            Set<SegmentKey> removedSegments
    ) {
        ArrayList<CorridorSegment> remaining = new ArrayList<>();
        for (CorridorSegment segment : segments == null ? List.<CorridorSegment>of() : segments) {
            if (segment == null
                    || removedNodeIds.contains(segment.startNodeId())
                    || removedNodeIds.contains(segment.endNodeId())
                    || removedSegments.contains(SegmentKey.of(segment))) {
                continue;
            }
            remaining.add(segment);
        }
        return remaining;
    }

    private static List<Component> components(Corridor corridor, List<CorridorSegment> remainingSegments) {
        if (remainingSegments == null || remainingSegments.isEmpty()) {
            return List.of();
        }
        Map<Long, CorridorNode> nodesById = nodesById(corridor.nodes());
        Map<Long, List<CorridorSegment>> segmentsByNodeId = new LinkedHashMap<>();
        for (CorridorSegment segment : remainingSegments) {
            segmentsByNodeId.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment);
            segmentsByNodeId.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment);
        }
        LinkedHashSet<Long> visitedNodeIds = new LinkedHashSet<>();
        ArrayList<Component> result = new ArrayList<>();
        for (Long nodeId : segmentsByNodeId.keySet()) {
            if (!visitedNodeIds.add(nodeId)) {
                continue;
            }
            LinkedHashSet<Long> componentNodeIds = new LinkedHashSet<>();
            LinkedHashSet<SegmentKey> componentSegmentKeys = new LinkedHashSet<>();
            ArrayDeque<Long> frontier = new ArrayDeque<>();
            frontier.add(nodeId);
            while (!frontier.isEmpty()) {
                Long currentNodeId = frontier.removeFirst();
                componentNodeIds.add(currentNodeId);
                for (CorridorSegment segment : segmentsByNodeId.getOrDefault(currentNodeId, List.of())) {
                    componentSegmentKeys.add(SegmentKey.of(segment));
                    Long neighbor = Objects.equals(segment.startNodeId(), currentNodeId) ? segment.endNodeId() : segment.startNodeId();
                    if (visitedNodeIds.add(neighbor)) {
                        frontier.addLast(neighbor);
                    }
                }
            }
            ArrayList<CorridorSegment> componentSegments = new ArrayList<>();
            for (CorridorSegment segment : remainingSegments) {
                if (componentSegmentKeys.contains(SegmentKey.of(segment))) {
                    componentSegments.add(segment);
                }
            }
            if (!componentSegments.isEmpty()) {
                result.add(new Component(nodesById, componentNodeIds, componentSegments));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static CorridorDraft draftForComponent(Corridor original, Component component, boolean primary) {
        Map<Long, CorridorNode> nodesById = component.nodesById();
        Map<Long, List<Long>> childrenByNode = rootedChildren(component, chooseRootNode(original, component));
        long rootNodeId = chooseRootNode(original, component);
        ArrayList<CorridorMember> members = new ArrayList<>();
        ArrayList<CorridorWaypoint> waypoints = new ArrayList<>();
        IdCursor ids = new IdCursor(-1L);
        Long primaryChild = primaryChild(rootNodeId, childrenByNode, nodesById);
        if (primaryChild == null) {
            throw new IllegalArgumentException("Corridor component must retain a path away from its root");
        }
        PathResult rootPath = memberPath(rootNodeId, primaryChild, childrenByNode, nodesById);
        Long rootMemberId = ids.nextMemberId();
        members.add(new CorridorMember(rootMemberId, terminalForNode(nodesById.get(rootPath.leafNodeId())), null, null));
        List<CorridorWaypoint> rootWaypoints = memberWaypoints(rootPath.pathNodeIds(), rootMemberId, nodesById);
        waypoints.addAll(rootWaypoints);
        Map<Long, Long> waypointIdsByNodeId = waypointIdsByNodeId(rootPath.pathNodeIds(), rootWaypoints);
        emitSideBranches(rootPath.pathNodeIds(), childrenByNode, nodesById, rootMemberId, waypointIdsByNodeId, members, waypoints, ids);
        return new CorridorDraft(
                primary ? original.corridorId() : null,
                primary ? original.structureObjectId() : null,
                original.mapId(),
                original.levelZ(),
                terminalForNode(nodesById.get(rootNodeId)),
                members,
                waypoints);
    }

    private static void emitSideBranches(
            List<Long> pathNodeIds,
            Map<Long, List<Long>> childrenByNode,
            Map<Long, CorridorNode> nodesById,
            Long ownerMemberId,
            Map<Long, Long> waypointIdsByNodeId,
            List<CorridorMember> members,
            List<CorridorWaypoint> waypoints,
            IdCursor ids
    ) {
        for (int index = 1; index < pathNodeIds.size() - 1; index++) {
            Long nodeId = pathNodeIds.get(index);
            Long nextPathNodeId = pathNodeIds.get(index + 1);
            Long hostWaypointId = waypointIdsByNodeId.get(nodeId);
            for (Long childNodeId : childrenByNode.getOrDefault(nodeId, List.of())) {
                if (Objects.equals(childNodeId, nextPathNodeId)) {
                    continue;
                }
                PathResult childPath = memberPath(nodeId, childNodeId, childrenByNode, nodesById);
                Long memberId = ids.nextMemberId();
                members.add(new CorridorMember(memberId, terminalForNode(nodesById.get(childPath.leafNodeId())), ownerMemberId, hostWaypointId));
                List<CorridorWaypoint> childWaypoints = memberWaypoints(childPath.pathNodeIds(), memberId, nodesById);
                waypoints.addAll(childWaypoints);
                Map<Long, Long> childWaypointIdsByNodeId = waypointIdsByNodeId(childPath.pathNodeIds(), childWaypoints);
                emitSideBranches(childPath.pathNodeIds(), childrenByNode, nodesById, memberId, childWaypointIdsByNodeId, members, waypoints, ids);
            }
        }
    }

    private static Map<Long, Long> waypointIdsByNodeId(List<Long> pathNodeIds, List<CorridorWaypoint> waypoints) {
        LinkedHashMap<Long, Long> result = new LinkedHashMap<>();
        int waypointIndex = 0;
        for (int index = 1; index < pathNodeIds.size() - 1; index++) {
            result.put(pathNodeIds.get(index), waypoints.get(waypointIndex++).waypointId());
        }
        return result;
    }

    private static List<CorridorWaypoint> memberWaypoints(
            List<Long> pathNodeIds,
            Long memberId,
            Map<Long, CorridorNode> nodesById
    ) {
        if (pathNodeIds.size() <= 2) {
            return List.of();
        }
        ArrayList<CorridorWaypoint> result = new ArrayList<>();
        for (int index = 1; index < pathNodeIds.size() - 1; index++) {
            Long nodeId = pathNodeIds.get(index);
            CorridorNode node = Objects.requireNonNull(nodesById.get(nodeId), "node");
            result.add(new CorridorWaypoint(nodeId, memberId, index - 1, node.point()));
        }
        return result;
    }

    private static PathResult memberPath(
            long startNodeId,
            long firstChildNodeId,
            Map<Long, List<Long>> childrenByNode,
            Map<Long, CorridorNode> nodesById
    ) {
        ArrayList<Long> path = new ArrayList<>();
        path.add(startNodeId);
        long previousNodeId = startNodeId;
        long currentNodeId = firstChildNodeId;
        while (true) {
            path.add(currentNodeId);
            Long nextChild = primaryChild(currentNodeId, childrenByNode, nodesById);
            if (nextChild == null || Objects.equals(nextChild, previousNodeId)) {
                return new PathResult(path, currentNodeId);
            }
            previousNodeId = currentNodeId;
            currentNodeId = nextChild;
        }
    }

    private static long chooseRootNode(Corridor original, Component component) {
        CorridorNode originalRoot = original.rootNode();
        if (originalRoot != null && component.nodeIds().contains(originalRoot.nodeId())) {
            return originalRoot.nodeId();
        }
        return leafNodes(component).stream()
                .sorted((left, right) -> compareLeaves(component.nodesById().get(left), component.nodesById().get(right)))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Corridor component requires a leaf root"));
    }

    private static int compareLeaves(CorridorNode left, CorridorNode right) {
        boolean leftDoor = left != null && left.isDoorBound();
        boolean rightDoor = right != null && right.isDoorBound();
        if (leftDoor != rightDoor) {
            return leftDoor ? -1 : 1;
        }
        if (leftDoor) {
            long leftId = left.doorRef() == null ? Long.MAX_VALUE : left.doorRef().doorId();
            long rightId = right.doorRef() == null ? Long.MAX_VALUE : right.doorRef().doorId();
            return Long.compare(leftId, rightId);
        }
        return GridPoint.ORDER.compare(left.point(), right.point());
    }

    private static Set<Long> leafNodes(Component component) {
        Map<Long, Integer> degrees = new LinkedHashMap<>();
        for (Long nodeId : component.nodeIds()) {
            degrees.put(nodeId, 0);
        }
        for (CorridorSegment segment : component.segments()) {
            degrees.computeIfPresent(segment.startNodeId(), (ignored, degree) -> degree + 1);
            degrees.computeIfPresent(segment.endNodeId(), (ignored, degree) -> degree + 1);
        }
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Map.Entry<Long, Integer> entry : degrees.entrySet()) {
            if (entry.getValue() == 1) {
                result.add(entry.getKey());
            }
        }
        return result;
    }

    private static Map<Long, List<Long>> rootedChildren(Component component, long rootNodeId) {
        Map<Long, List<Long>> adjacency = adjacency(component.segments());
        LinkedHashMap<Long, List<Long>> childrenByNode = new LinkedHashMap<>();
        ArrayDeque<Long> frontier = new ArrayDeque<>();
        frontier.add(rootNodeId);
        LinkedHashMap<Long, Long> parentByNodeId = new LinkedHashMap<>();
        parentByNodeId.put(rootNodeId, null);
        while (!frontier.isEmpty()) {
            Long nodeId = frontier.removeFirst();
            ArrayList<Long> children = new ArrayList<>();
            for (Long neighbor : adjacency.getOrDefault(nodeId, List.of())) {
                if (Objects.equals(parentByNodeId.get(nodeId), neighbor)) {
                    continue;
                }
                parentByNodeId.put(neighbor, nodeId);
                children.add(neighbor);
                frontier.addLast(neighbor);
            }
            childrenByNode.put(nodeId, List.copyOf(children));
        }
        return Map.copyOf(childrenByNode);
    }

    private static Long primaryChild(
            long nodeId,
            Map<Long, List<Long>> childrenByNode,
            Map<Long, CorridorNode> nodesById
    ) {
        List<Long> children = childrenByNode.getOrDefault(nodeId, List.of());
        if (children.isEmpty()) {
            return null;
        }
        Long bestChild = null;
        LeafScore bestScore = null;
        for (Long child : children) {
            LeafScore score = leafScore(child, childrenByNode, nodesById);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestScore = score;
                bestChild = child;
            }
        }
        return bestChild;
    }

    private static LeafScore leafScore(
            long nodeId,
            Map<Long, List<Long>> childrenByNode,
            Map<Long, CorridorNode> nodesById
    ) {
        List<Long> children = childrenByNode.getOrDefault(nodeId, List.of());
        CorridorNode node = nodesById.get(nodeId);
        if (children.isEmpty()) {
            return LeafScore.leaf(node);
        }
        LeafScore best = null;
        for (Long child : children) {
            LeafScore childScore = leafScore(child, childrenByNode, nodesById).incrementDistance();
            if (best == null || childScore.compareTo(best) < 0) {
                best = childScore;
            }
        }
        return best;
    }

    private static Map<Long, List<Long>> adjacency(Collection<CorridorSegment> segments) {
        LinkedHashMap<Long, ArrayList<Long>> adjacency = new LinkedHashMap<>();
        for (CorridorSegment segment : segments == null ? List.<CorridorSegment>of() : segments) {
            adjacency.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment.endNodeId());
            adjacency.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment.startNodeId());
        }
        LinkedHashMap<Long, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, ArrayList<Long>> entry : adjacency.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<Long, CorridorNode> nodesById(Collection<CorridorNode> nodes) {
        LinkedHashMap<Long, CorridorNode> result = new LinkedHashMap<>();
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
            result.put(node.nodeId(), node);
        }
        return Map.copyOf(result);
    }

    private static CorridorTerminal terminalForNode(CorridorNode node) {
        if (node == null) {
            throw new IllegalArgumentException("Corridor component terminal node is required");
        }
        return node.isDoorBound()
                ? new CorridorTerminal.DoorTerminal(node.doorRef())
                : new CorridorTerminal.PointTerminal(node.point());
    }

    private static List<Door> componentDoors(Corridor corridor, Set<SegmentKey> segmentKeys) {
        GridArea componentArea = features.world.dungeon.dungeonmap.corridor.model.CorridorRouting.surfaceAreaForTraces(
                corridor.pathTraces().stream()
                        .filter(trace -> trace != null && segmentKeys.contains(new SegmentKey(trace.memberId(), trace.segmentOrdinal())))
                        .toList());
        if (componentArea.isEmpty()) {
            return List.of();
        }
        return corridor.boundaryAtLevel(corridor.levelZ()).doors().stream()
                .filter(Objects::nonNull)
                .filter(door -> door.touchesAnyCell(componentArea))
                .toList();
    }

    private record SegmentKey(Long memberId, int segmentOrdinal) {
        private static SegmentKey of(CorridorSegment segment) {
            return new SegmentKey(segment.memberId(), segment.segmentOrdinal());
        }
    }

    private record Component(
            Map<Long, CorridorNode> nodesById,
            Set<Long> nodeIds,
            List<CorridorSegment> segments
    ) {
        private Set<SegmentKey> segmentKeys() {
            LinkedHashSet<SegmentKey> result = new LinkedHashSet<>();
            for (CorridorSegment segment : segments) {
                result.add(SegmentKey.of(segment));
            }
            return result;
        }
    }

    private record PathResult(
            List<Long> pathNodeIds,
            long leafNodeId
    ) {
    }

    private static final class IdCursor {
        private long nextMemberId;

        private IdCursor(long nextMemberId) {
            this.nextMemberId = nextMemberId;
        }

        private Long nextMemberId() {
            return nextMemberId--;
        }
    }

    private record LeafScore(
            int distance,
            boolean doorLeaf,
            long tieBreaker
    ) implements Comparable<LeafScore> {
        private static LeafScore leaf(CorridorNode node) {
            boolean doorLeaf = node != null && node.isDoorBound();
            long tieBreaker = doorLeaf
                    ? (node.doorRef() == null ? Long.MAX_VALUE : node.doorRef().doorId())
                    : ((long) node.point().x2() << 32) ^ (long) node.point().y2();
            return new LeafScore(0, doorLeaf, tieBreaker);
        }

        private LeafScore incrementDistance() {
            return new LeafScore(distance + 1, doorLeaf, tieBreaker);
        }

        @Override
        public int compareTo(LeafScore other) {
            int distanceCompare = Integer.compare(other.distance, distance);
            if (distanceCompare != 0) {
                return distanceCompare;
            }
            if (doorLeaf != other.doorLeaf) {
                return doorLeaf ? -1 : 1;
            }
            return Long.compare(tieBreaker, other.tieBreaker);
        }
    }
}
