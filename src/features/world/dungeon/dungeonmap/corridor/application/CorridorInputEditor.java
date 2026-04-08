package features.world.dungeon.dungeonmap.corridor.application;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInputNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSegment;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
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

public final class CorridorInputEditor {

    private CorridorInputEditor() {
        throw new AssertionError("No instances");
    }

    public static CorridorInput newDoorToDoorInput(long mapId, int levelZ, DoorRef startDoorRef, DoorRef endDoorRef) {
        Objects.requireNonNull(startDoorRef, "startDoorRef");
        Objects.requireNonNull(endDoorRef, "endDoorRef");
        return new CorridorInput(
                null,
                null,
                mapId,
                levelZ,
                List.of(
                        new CorridorInputNode(-1L, startDoorRef, null),
                        new CorridorInputNode(-2L, endDoorRef, null)),
                List.of(new CorridorSegment(-1L, -1L, -2L)));
    }

    public static CorridorInput moveNode(CorridorInput input, Long nodeId, GridPoint targetPoint) {
        Objects.requireNonNull(targetPoint, "targetPoint");
        CorridorInputNode node = requiredNode(input, nodeId);
        if (node.isDoorBound()) {
            throw new IllegalArgumentException("Door-bound corridor nodes may not be moved directly");
        }
        ArrayList<CorridorInputNode> updatedNodes = new ArrayList<>(input.nodes().size());
        for (CorridorInputNode candidate : input.nodes()) {
            updatedNodes.add(Objects.equals(candidate.nodeId(), nodeId)
                    ? new CorridorInputNode(candidate.nodeId(), null, targetPoint)
                    : candidate);
        }
        return new CorridorInput(input.corridorId(), input.structureObjectId(), input.mapId(), input.levelZ(), updatedNodes, input.segments());
    }

    public static CorridorInput moveDoor(CorridorInput input, Long nodeId, DoorRef targetDoorRef) {
        Objects.requireNonNull(targetDoorRef, "targetDoorRef");
        CorridorInputNode node = requiredNode(input, nodeId);
        if (!node.isDoorBound()) {
            throw new IllegalArgumentException("Only door-bound corridor nodes may move to another door");
        }
        ArrayList<CorridorInputNode> updatedNodes = new ArrayList<>(input.nodes().size());
        for (CorridorInputNode candidate : input.nodes()) {
            updatedNodes.add(Objects.equals(candidate.nodeId(), nodeId)
                    ? new CorridorInputNode(candidate.nodeId(), targetDoorRef, null)
                    : candidate);
        }
        return new CorridorInput(input.corridorId(), input.structureObjectId(), input.mapId(), input.levelZ(), updatedNodes, input.segments());
    }

    public static CorridorInput moveDoorAtBoundary(Corridor corridor, GridSegment boundarySegment, DoorRef targetDoorRef) {
        Objects.requireNonNull(corridor, "corridor");
        Objects.requireNonNull(boundarySegment, "boundarySegment");
        Long nodeId = corridor.doorNodeIdAtBoundary(boundarySegment);
        if (nodeId == null) {
            throw new IllegalArgumentException("Unknown corridor door boundary " + boundarySegment);
        }
        return moveDoor(corridor.input(), nodeId, targetDoorRef);
    }

    public static CorridorInput insertNodeOnSegment(CorridorInput input, Long segmentId, GridPoint point) {
        Objects.requireNonNull(point, "point");
        CorridorSegment segment = requiredSegment(input, segmentId);
        Long existingNodeId = nodeIdAtPoint(input, point);
        if (existingNodeId != null && !Objects.equals(existingNodeId, segment.startNodeId()) && !Objects.equals(existingNodeId, segment.endNodeId())) {
            return splitSegment(input, segment, existingNodeId, false);
        }
        long newNodeId = nextSyntheticNodeId(input.nodes());
        CorridorInput withNode = new CorridorInput(
                input.corridorId(),
                input.structureObjectId(),
                input.mapId(),
                input.levelZ(),
                append(input.nodes(), new CorridorInputNode(newNodeId, null, point)),
                input.segments());
        return splitSegment(withNode, segment, newNodeId, false);
    }

    public static CorridorInput attachDoor(CorridorInput input, Long segmentId, GridPoint point, DoorRef doorRef) {
        Objects.requireNonNull(point, "point");
        Objects.requireNonNull(doorRef, "doorRef");
        if (containsDoor(input, doorRef)) {
            return input;
        }
        CorridorInput split = insertNodeOnSegment(input, segmentId, point);
        Long attachNodeId = Objects.requireNonNull(nodeIdAtPoint(split, point), "attachNodeId");
        long newDoorNodeId = nextSyntheticNodeId(split.nodes());
        long newSegmentId = nextSyntheticSegmentId(split.segments());
        return new CorridorInput(
                split.corridorId(),
                split.structureObjectId(),
                split.mapId(),
                split.levelZ(),
                append(split.nodes(), new CorridorInputNode(newDoorNodeId, doorRef, null)),
                append(split.segments(), new CorridorSegment(newSegmentId, attachNodeId, newDoorNodeId)));
    }

    public static List<CorridorInput> deleteSegment(CorridorInput input, Long segmentId) {
        requiredSegment(input, segmentId);
        List<CorridorSegment> remaining = input.segments().stream()
                .filter(segment -> !Objects.equals(segment.segmentId(), segmentId))
                .toList();
        return partition(new CorridorInput(input.corridorId(), input.structureObjectId(), input.mapId(), input.levelZ(), input.nodes(), remaining));
    }

    public static List<CorridorInput> deleteNode(CorridorInput input, Long nodeId) {
        CorridorInputNode node = requiredNode(input, nodeId);
        List<CorridorSegment> incidentSegments = incidentSegments(input, nodeId);
        if (incidentSegments.isEmpty()) {
            throw new IllegalArgumentException("Corridor node is isolated");
        }
        if (incidentSegments.size() > 2) {
            throw new IllegalArgumentException("Junction nodes must be simplified by deleting segments first");
        }
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>();
        for (CorridorSegment segment : input.segments()) {
            if (!segment.touches(nodeId)) {
                updatedSegments.add(segment);
            }
        }
        if (incidentSegments.size() == 2) {
            Long startNodeId = incidentSegments.get(0).otherNodeId(nodeId);
            Long endNodeId = incidentSegments.get(1).otherNodeId(nodeId);
            updatedSegments.add(new CorridorSegment(nextSyntheticSegmentId(updatedSegments), startNodeId, endNodeId));
        }
        List<CorridorInputNode> updatedNodes = input.nodes().stream()
                .filter(candidate -> !Objects.equals(candidate.nodeId(), node.nodeId()))
                .toList();
        return partition(new CorridorInput(input.corridorId(), input.structureObjectId(), input.mapId(), input.levelZ(), updatedNodes, updatedSegments));
    }

    public static List<CorridorInput> deleteDoorAtBoundary(Corridor corridor, GridSegment boundarySegment) {
        Objects.requireNonNull(corridor, "corridor");
        Objects.requireNonNull(boundarySegment, "boundarySegment");
        Long nodeId = corridor.doorNodeIdAtBoundary(boundarySegment);
        if (nodeId == null) {
            throw new IllegalArgumentException("Unknown corridor door boundary " + boundarySegment);
        }
        return deleteNode(corridor.input(), nodeId);
    }

    private static CorridorInput splitSegment(CorridorInput input, CorridorSegment segment, Long midNodeId, boolean keepOriginalSegmentId) {
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>(input.segments().size() + 1);
        for (CorridorSegment candidate : input.segments()) {
            if (!Objects.equals(candidate.segmentId(), segment.segmentId())) {
                updatedSegments.add(candidate);
            }
        }
        long firstSegmentId = keepOriginalSegmentId ? segment.segmentId() : nextSyntheticSegmentId(updatedSegments);
        updatedSegments.add(new CorridorSegment(firstSegmentId, segment.startNodeId(), midNodeId));
        updatedSegments.add(new CorridorSegment(nextSyntheticSegmentId(updatedSegments), midNodeId, segment.endNodeId()));
        return new CorridorInput(input.corridorId(), input.structureObjectId(), input.mapId(), input.levelZ(), input.nodes(), updatedSegments);
    }

    private static List<CorridorInput> partition(CorridorInput input) {
        if (input.segments().isEmpty()) {
            return List.of();
        }
        Map<Long, CorridorInputNode> nodesById = nodesById(input.nodes());
        Map<Long, List<CorridorSegment>> segmentsByNodeId = new LinkedHashMap<>();
        for (CorridorSegment segment : input.segments()) {
            segmentsByNodeId.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment);
            segmentsByNodeId.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment);
        }

        LinkedHashSet<Long> visitedNodeIds = new LinkedHashSet<>();
        ArrayList<CorridorInput> result = new ArrayList<>();
        for (Long nodeId : segmentsByNodeId.keySet()) {
            if (!visitedNodeIds.add(nodeId)) {
                continue;
            }
            LinkedHashSet<Long> componentNodeIds = new LinkedHashSet<>();
            LinkedHashSet<Long> componentSegmentIds = new LinkedHashSet<>();
            ArrayDeque<Long> frontier = new ArrayDeque<>();
            frontier.add(nodeId);
            while (!frontier.isEmpty()) {
                Long currentNodeId = frontier.removeFirst();
                componentNodeIds.add(currentNodeId);
                for (CorridorSegment segment : segmentsByNodeId.getOrDefault(currentNodeId, List.of())) {
                    componentSegmentIds.add(segment.segmentId());
                    Long neighbor = segment.otherNodeId(currentNodeId);
                    if (neighbor != null && visitedNodeIds.add(neighbor)) {
                        frontier.addLast(neighbor);
                    }
                }
            }
            List<CorridorInputNode> componentNodes = input.nodes().stream()
                    .filter(node -> componentNodeIds.contains(node.nodeId()))
                    .toList();
            List<CorridorSegment> componentSegments = input.segments().stream()
                    .filter(segment -> componentSegmentIds.contains(segment.segmentId()))
                    .toList();
            if (!componentSegments.isEmpty()) {
                result.add(new CorridorInput(null, null, input.mapId(), input.levelZ(), componentNodes, componentSegments));
            }
        }
        return result.stream()
                .sorted(Comparator
                        .comparingInt((CorridorInput candidate) -> candidate.segments().size())
                        .thenComparingInt(candidate -> candidate.nodes().size())
                        .reversed())
                .toList();
    }

    private static CorridorInputNode requiredNode(CorridorInput input, Long nodeId) {
        CorridorInputNode node = input == null ? null : nodesById(input.nodes()).get(nodeId);
        if (node == null) {
            throw new IllegalArgumentException("Unknown corridor node " + nodeId);
        }
        return node;
    }

    private static CorridorSegment requiredSegment(CorridorInput input, Long segmentId) {
        CorridorSegment segment = input == null ? null : segmentsById(input.segments()).get(segmentId);
        if (segment == null) {
            throw new IllegalArgumentException("Unknown corridor segment " + segmentId);
        }
        return segment;
    }

    private static List<CorridorSegment> incidentSegments(CorridorInput input, Long nodeId) {
        return input.segments().stream()
                .filter(segment -> segment != null && segment.touches(nodeId))
                .toList();
    }

    private static Long nodeIdAtPoint(CorridorInput input, GridPoint point) {
        return input.nodes().stream()
                .filter(node -> node != null && !node.isDoorBound() && Objects.equals(node.fixedPoint(), point))
                .map(CorridorInputNode::nodeId)
                .findFirst()
                .orElse(null);
    }

    private static boolean containsDoor(CorridorInput input, DoorRef doorRef) {
        return input.nodes().stream()
                .filter(Objects::nonNull)
                .filter(CorridorInputNode::isDoorBound)
                .anyMatch(node -> Objects.equals(node.doorRef(), doorRef));
    }

    private static long nextSyntheticNodeId(Collection<CorridorInputNode> nodes) {
        long min = -1L;
        for (CorridorInputNode node : nodes == null ? List.<CorridorInputNode>of() : nodes) {
            if (node != null && node.nodeId() != null) {
                min = Math.min(min, node.nodeId());
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    private static long nextSyntheticSegmentId(Collection<CorridorSegment> segments) {
        long min = -1L;
        for (CorridorSegment segment : segments == null ? List.<CorridorSegment>of() : segments) {
            if (segment != null && segment.segmentId() != null) {
                min = Math.min(min, segment.segmentId());
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    private static Map<Long, CorridorInputNode> nodesById(List<CorridorInputNode> nodes) {
        LinkedHashMap<Long, CorridorInputNode> result = new LinkedHashMap<>();
        for (CorridorInputNode node : nodes == null ? List.<CorridorInputNode>of() : nodes) {
            if (node != null && node.nodeId() != null) {
                result.put(node.nodeId(), node);
            }
        }
        return result;
    }

    private static Map<Long, CorridorSegment> segmentsById(List<CorridorSegment> segments) {
        LinkedHashMap<Long, CorridorSegment> result = new LinkedHashMap<>();
        for (CorridorSegment segment : segments == null ? List.<CorridorSegment>of() : segments) {
            if (segment != null && segment.segmentId() != null) {
                result.put(segment.segmentId(), segment);
            }
        }
        return result;
    }

    private static <T> List<T> append(List<T> items, T appended) {
        ArrayList<T> result = new ArrayList<>(items == null ? List.<T>of() : items);
        result.add(appended);
        return List.copyOf(result);
    }
}
