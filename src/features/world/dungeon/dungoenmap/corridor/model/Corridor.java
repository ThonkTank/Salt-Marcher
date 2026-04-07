package features.world.dungeon.dungoenmap.corridor.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungoenmap.structure.model.Structure;
import features.world.dungeon.dungoenmap.structure.model.StructureSpecification;
import features.world.dungeon.dungoenmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungoenmap.structure.model.room.StructureRoomTopology;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.ConnectionKind;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.room.Room;

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

/**
 * Corridors are edited and persisted as standalone structures.
 *
 * <p>The behavior to preserve here is: corridor routing data stays corridor-owned, the referenced
 * {@link Structure} carries the realized physical topology, room attachments stay explicit, and callers must get
 * the same corridor behavior without any second physical boundary owner.
 */
public final class Corridor extends Structure {

    private final Long corridorId;
    private final Long structureObjectId;
    private final long mapId;
    private final int levelZ;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final List<CorridorPathTrace> pathTraces;
    private final List<DungeonConnection> connections;

    public static Corridor fromSpecification(
            CorridorSpecification specification,
            CorridorResolutionInput input
    ) {
        CorridorSpecification resolvedSpecification = Objects.requireNonNull(specification, "specification");
        CorridorResolutionInput resolvedInput = requireInput(resolvedSpecification.levelZ(), input);
        return new Corridor(resolvedSpecification, deriveState(resolvedSpecification, resolvedInput), resolvedInput);
    }

    public static Corridor rehydrated(
            CorridorSpecification specification,
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            CorridorResolutionInput input
    ) {
        CorridorSpecification resolvedSpecification = Objects.requireNonNull(specification, "specification");
        CorridorResolutionInput resolvedInput = requireInput(resolvedSpecification.levelZ(), input);
        return new Corridor(
                resolvedSpecification,
                rehydratedState(resolvedSpecification, structure, pathTraces, resolvedInput),
                resolvedInput);
    }

    private Corridor(
            CorridorSpecification specification,
            CorridorState state,
            CorridorResolutionInput input
    ) {
        super(state.structure());
        CorridorSpecification resolvedSpecification = Objects.requireNonNull(specification, "specification");
        CorridorResolutionInput resolvedInput = requireInput(resolvedSpecification.levelZ(), input);
        this.corridorId = resolvedSpecification.corridorId();
        this.structureObjectId = resolvedSpecification.structureObjectId();
        this.mapId = resolvedSpecification.mapId();
        this.levelZ = resolvedSpecification.levelZ();
        this.nodes = normalizeNodes(resolvedInput, levelZ, resolvedSpecification.nodes());
        this.segments = normalizeSegments(resolvedSpecification.segments());
        validateTopology(this.nodes, this.segments);
        this.pathTraces = state.pathTraces();
        this.connections = state.connections();
    }

    private Corridor(
            Long corridorId,
            Long structureObjectId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections
    ) {
        super(levelsByZ, roomTopology);
        this.corridorId = corridorId;
        this.structureObjectId = structureObjectId;
        this.mapId = mapId;
        this.levelZ = levelZ;
        this.nodes = nodes == null ? List.of() : List.copyOf(nodes);
        this.segments = segments == null ? List.of() : List.copyOf(segments);
        this.pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
        this.connections = connections == null ? List.of() : List.copyOf(connections);
    }

    @Override
    protected Corridor recreate(
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        return new Corridor(corridorId, structureObjectId, mapId, levelZ, nodes, segments, levelsByZ, roomTopology, pathTraces, connections);
    }

    private static CorridorState deriveState(
            CorridorSpecification specification,
            CorridorResolutionInput input
    ) {
        CorridorSpecification resolvedSpecification = Objects.requireNonNull(specification, "specification");
        CorridorResolutionInput resolvedInput = requireInput(resolvedSpecification.levelZ(), input);
        List<CorridorNode> resolvedNodes = normalizeNodes(resolvedInput, resolvedSpecification.levelZ(), resolvedSpecification.nodes());
        List<CorridorSegment> resolvedSegments = normalizeSegments(resolvedSpecification.segments());
        validateTopology(resolvedNodes, resolvedSegments);
        DerivedProjection projection = deriveProjection(
                resolvedSpecification.corridorId(),
                resolvedSpecification.mapId(),
                resolvedSpecification.levelZ(),
                resolvedNodes,
                resolvedSegments,
                resolvedInput);
        return new CorridorState(projection.structure(), projection.pathTraces(), projection.connections());
    }

    private static CorridorState rehydratedState(
            CorridorSpecification specification,
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            CorridorResolutionInput input
    ) {
        CorridorSpecification resolvedSpecification = Objects.requireNonNull(specification, "specification");
        CorridorResolutionInput resolvedInput = requireInput(resolvedSpecification.levelZ(), input);
        Structure hydratedStructure = Objects.requireNonNull(structure, "structure");
        List<CorridorNode> resolvedNodes = normalizeNodes(resolvedInput, resolvedSpecification.levelZ(), resolvedSpecification.nodes());
        List<CorridorSegment> resolvedSegments = normalizeSegments(resolvedSpecification.segments());
        validateTopology(resolvedNodes, resolvedSegments);
        if (hydratedStructure.surfaceAtLevel(resolvedSpecification.levelZ()).isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor structure must exist at the corridor level");
        }
        return new CorridorState(
                hydratedStructure,
                pathTraces == null ? List.of() : List.copyOf(pathTraces),
                materializeConnections(
                        resolvedInput,
                        resolvedSpecification.corridorId(),
                        resolvedSpecification.mapId(),
                        resolvedSpecification.levelZ(),
                        resolvedNodes));
    }

    private record CorridorState(
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections
    ) {
        private CorridorState {
            structure = Objects.requireNonNull(structure, "structure");
            pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
            connections = connections == null ? List.of() : List.copyOf(connections);
        }
    }

    private static CorridorResolutionInput requireInput(int levelZ, CorridorResolutionInput input) {
        CorridorResolutionInput resolvedInput = Objects.requireNonNull(input, "input");
        if (resolvedInput.levelZ() != levelZ) {
            throw new IllegalArgumentException("Corridor resolution input level must match corridor level");
        }
        return resolvedInput;
    }

    private CorridorSpecification specification() {
        return new CorridorSpecification(corridorId, structureObjectId, mapId, levelZ, nodes, segments);
    }

    public Long corridorId() {
        return corridorId;
    }

    public Long structureObjectId() {
        return structureObjectId;
    }

    public long mapId() {
        return mapId;
    }

    public int levelZ() {
        return levelZ;
    }

    public List<CorridorNode> nodes() {
        return nodes;
    }

    public List<CorridorSegment> segments() {
        return segments;
    }

    public List<Long> connectedRoomIds() {
        return connections.stream()
                .filter(Objects::nonNull)
                .flatMap(connection -> connection.endpoints().stream())
                .filter(endpoint -> endpoint != null && endpoint.type() == features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    public List<CorridorPathTrace> pathTraces() {
        return pathTraces;
    }

    public List<DungeonConnection> connections() {
        return connections;
    }

    public Set<GridSegment> boundaryDoorSegments(CorridorResolutionInput input) {
        StructureBoundary boundary = boundaryAtLevel(levelZ);
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>(boundary.doorBoundaryEdges());
        for (CorridorNode node : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = input == null ? null : input.exteriorDoorsByRef().get(node.doorRef());
            if (description == null) {
                continue;
            }
            result.addAll(description.door().boundarySegments().stream()
                    .filter(boundary.boundaryEdges()::contains)
                    .toList());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Corridor mutated(CorridorMutation mutation, CorridorResolutionInput input) {
        if (mutation == null) {
            return this;
        }
        return switch (mutation) {
            case CorridorMutation.NodeMove edit -> movedNode(edit.nodeId(), edit.point(), input);
            case CorridorMutation.TileNodePromotionAndMove edit -> promotedTileNodeAndMoved(edit.tileCell(), edit.targetPoint(), input);
            case CorridorMutation.AttachRoomDoorAtBoundary edit -> attachedRoomNodeAtBoundary(edit.doorRef(), edit.boundarySegment(), input);
            case CorridorMutation.DoorMove edit -> movedDoor(edit.sourceBoundarySegment(), edit.targetDoorRef(), input);
            case CorridorMutation.ReplaceDoors edit -> withDoors(edit.doors(), input);
            case CorridorMutation.DeleteNode ignored ->
                    throw new IllegalArgumentException("Topology deletes must go through topologyUpdated(...)");
            case CorridorMutation.DeleteSegment ignored ->
                    throw new IllegalArgumentException("Topology deletes must go through topologyUpdated(...)");
        };
    }

    public CorridorTopologyUpdate topologyUpdated(CorridorMutation mutation) {
        if (mutation == null) {
            return CorridorTopologyUpdate.unchanged();
        }
        return switch (mutation) {
            case CorridorMutation.DeleteSegment edit -> deletedSegment(edit.segmentId());
            case CorridorMutation.DeleteNode edit -> deletedNode(edit.nodeId());
            default -> throw new IllegalArgumentException("Only topology delete mutations produce topology updates");
        };
    }

    public void validateReconcile(CorridorReconcileInput input) {
        if (input == null || !input.hasAffectedRooms()) {
            return;
        }
        for (CorridorNode node : nodes) {
            if (shouldRebindNode(input.originalDoorsByRef(), node, input.affectedRoomIds())) {
                resolveDoorRewriteBinding(input, node, false);
            }
        }
    }

    public Corridor reconciled(CorridorReconcileInput input) {
        if (input == null || !input.hasAffectedRooms()) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            CorridorNode updatedNode = node;
            if (shouldRebindNode(input.originalDoorsByRef(), node, input.affectedRoomIds())) {
                if (input.levelDelta() != 0) {
                    updatedNode = new CorridorNode(node.nodeId(), node.point(), null);
                } else if (node != null && node.doorRef() != null) {
                    CorridorResolutionInput.ExteriorDoorInput reboundDoor = input.updatedDoorsByRef().get(node.doorRef());
                    updatedNode = reboundDoor == null
                            ? new CorridorNode(node.nodeId(), node.point(), null)
                            : new CorridorNode(node.nodeId(), reboundDoor.anchorPoint(), reboundDoor.ref());
                }
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        if (!changed) {
            return this;
        }
        Corridor reboundCorridor = resolvedAgainst(input.updatedResolution(), updatedNodes, segments);
        GridTranslation translation = input.translation() == null ? GridTranslation.none() : input.translation();
        if (translation.isZero()
                && !reboundCorridor.pathTraces().equals(pathTraces)) {
            throw new IllegalArgumentException("Corridor room rewrite may not reroute corridor");
        }
        return reboundCorridor;
    }

    private Corridor withDoors(Collection<Door> doors, CorridorResolutionInput input) {
        return resolvedAgainst(input, nodes, segments, doors);
    }

    private Corridor movedNode(Long nodeId, GridPoint point2x, CorridorResolutionInput input) {
        if (nodeId == null || point2x == null) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            if (node == null) {
                continue;
            }
            CorridorNode updatedNode = node;
            if (nodeId.equals(node.nodeId()) && !node.isDoorBound()) {
                updatedNode = new CorridorNode(node.nodeId(), point2x, null);
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        return changed ? resolvedAgainst(input, updatedNodes, segments) : this;
    }

    private Corridor movedDoor(GridSegment sourceBoundarySegment2x, DoorRef targetDoorRef, CorridorResolutionInput input) {
        if (sourceBoundarySegment2x == null || targetDoorRef == null) {
            return this;
        }
        CorridorNode sourceNode = findRoomBoundNodeAtBoundary(sourceBoundarySegment2x);
        if (sourceNode == null || sourceNode.nodeId() == null) {
            return this;
        }
        CorridorResolutionInput.ExteriorDoorInput sourceDoor = requiredExteriorDoor(input, sourceNode.doorRef());
        CorridorResolutionInput.ExteriorDoorInput targetDoor = requiredExteriorDoor(input, targetDoorRef);
        if (!Objects.equals(sourceDoor.roomId(), targetDoor.roomId())) {
            throw new IllegalArgumentException("Corridor door move must stay on the same room");
        }
        GridSegment targetBoundarySegment2x = targetDoor.anchorSegment();
        if (Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)) {
            return this;
        }
        if (input.hasOccupiedConnection(targetBoundarySegment2x)) {
            throw new IllegalArgumentException("Corridor door move target is already occupied");
        }

        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            CorridorNode updatedNode = node;
            if (Objects.equals(node.nodeId(), sourceNode.nodeId())) {
                updatedNode = new CorridorNode(node.nodeId(), targetDoor.anchorPoint(), targetDoor.ref());
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        return changed ? resolvedAgainst(input, updatedNodes, segments) : this;
    }

    private Corridor promotedTileNode(GridPoint tileCell, CorridorResolutionInput input) {
        if (tileCell == null) {
            return this;
        }
        GridPoint tilePoint = tileCell;
        CorridorNode existingNode = findFreeNodeAtPoint(tilePoint);
        if (existingNode != null) {
            return this;
        }
        long newNodeId = nextSyntheticNodeId();
        long nextSyntheticSegmentId = nextSyntheticSegmentId();
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes);
        updatedNodes.add(new CorridorNode(newNodeId, tilePoint, null));
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>();
        LinkedHashSet<String> seenEdges = new LinkedHashSet<>();
        boolean changed = false;
        for (CorridorSegment segment : segments) {
            CorridorPathTrace trace = traceForSegment(this, segment == null ? null : segment.segmentId());
            if (segment == null || trace == null || !trace.points().contains(tilePoint)) {
                addUniqueSegment(updatedSegments, seenEdges, segment);
                continue;
            }
            changed = true;
            addUniqueSegment(updatedSegments, seenEdges, new CorridorSegment(segment.segmentId(), segment.startNodeId(), newNodeId));
            addUniqueSegment(updatedSegments, seenEdges, new CorridorSegment(nextSyntheticSegmentId--, newNodeId, segment.endNodeId()));
        }
        if (!changed) {
            throw new IllegalArgumentException("Corridor tile is not on a routable corridor segment");
        }
        return resolvedAgainst(input, updatedNodes, updatedSegments);
    }

    private Corridor promotedTileNodeAndMoved(GridPoint tileCell, GridPoint point2x, CorridorResolutionInput input) {
        if (tileCell == null || point2x == null) {
            return this;
        }
        Corridor promoted = promotedTileNode(tileCell, input);
        CorridorNode promotedNode = promoted.findFreeNodeAtPoint(tileCell);
        if (promotedNode == null || Objects.equals(promotedNode.point(), point2x)) {
            return promoted;
        }
        return promoted.movedNode(promotedNode.nodeId(), point2x, input);
    }

    private Corridor attachedRoomNodeAtTile(DoorRef doorRef, GridPoint tileCell, CorridorResolutionInput input) {
        if (doorRef == null || tileCell == null) {
            return this;
        }
        CorridorResolutionInput.ExteriorDoorInput roomDoor = requiredExteriorDoor(input, doorRef);
        GridSegment boundarySegment2x = roomDoor.anchorSegment();
        if (boundarySegment2x != null && findRoomBoundNodeAtBoundary(boundarySegment2x) != null) {
            return this;
        }
        Corridor promoted = promotedTileNode(tileCell, input);
        CorridorNode attachNode = promoted.findFreeNodeAtPoint(tileCell);
        if (attachNode == null) {
            throw new IllegalArgumentException("Corridor tile did not resolve to a fixed node");
        }
        long newNodeId = promoted.nextSyntheticNodeId();
        long newSegmentId = promoted.nextSyntheticSegmentId();
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(promoted.nodes);
        updatedNodes.add(new CorridorNode(newNodeId, roomDoor.anchorPoint(), roomDoor.ref()));
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>(promoted.segments);
        updatedSegments.add(new CorridorSegment(newSegmentId, attachNode.nodeId(), newNodeId));
        return promoted.resolvedAgainst(input, updatedNodes, updatedSegments);
    }

    /**
     * Wall-based attach picks the unique corridor cell behind that boundary so the editor does not own
     * corridor-boundary-to-tile translation policy.
     */
    private Corridor attachedRoomNodeAtBoundary(
            DoorRef doorRef,
            GridSegment boundarySegment2x,
            CorridorResolutionInput input
    ) {
        if (doorRef == null || boundarySegment2x == null) {
            return this;
        }
        CorridorResolutionInput.BoundaryAttachmentInput boundary = requireInput(levelZ, input).requiredBoundaryAttachment(boundarySegment2x);
        if (!Objects.equals(boundary.corridorId(), corridorId)) {
            throw new IllegalArgumentException("Corridor attachment target must be a free corridor wall");
        }
        return attachedRoomNodeAtTile(doorRef, boundary.corridorCell(), input);
    }

    public CorridorTopologyUpdate deletedSegment(Long segmentId) {
        CorridorSegment target = findSegment(segmentId);
        if (target == null) {
            return CorridorTopologyUpdate.unchanged();
        }
        return topologyAfterRemoval(Set.of(), Set.of(segmentId));
    }

    public CorridorTopologyUpdate deletedNode(Long nodeId) {
        CorridorNode removed = findNode(nodeId);
        if (removed == null) {
            return CorridorTopologyUpdate.unchanged();
        }
        return topologyAfterRemoval(Set.of(nodeId), Set.of());
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && connectedRoomIds().contains(roomId);
    }

    public CorridorNode findNode(Long nodeId) {
        if (nodeId == null) {
            return null;
        }
        return nodes.stream()
                .filter(node -> nodeId.equals(node.nodeId()))
                .findFirst()
                .orElse(null);
    }

    public CorridorNode findFreeNodeAtPoint(GridPoint point2x) {
        if (point2x == null) {
            return null;
        }
        return nodes.stream()
                .filter(node -> node != null && !node.isDoorBound() && point2x.equals(node.point()))
                .findFirst()
                .orElse(null);
    }

    public CorridorNode findRoomBoundNodeAtBoundary(GridSegment boundarySegment2x) {
        if (boundarySegment2x == null) {
            return null;
        }
        return nodes.stream()
                .filter(CorridorNode::isDoorBound)
                .filter(node -> boundarySegment2x.midpoint().equals(node.point()))
                .findFirst()
                .orElse(null);
    }

    public CorridorSegment findSegment(Long segmentId) {
        if (segmentId == null) {
            return null;
        }
        return segments.stream()
                .filter(segment -> segmentId.equals(segment.segmentId()))
                .findFirst()
                .orElse(null);
    }

    public List<CorridorSegment> segmentsForNode(Long nodeId) {
        if (nodeId == null) {
            return List.of();
        }
        return segments.stream()
                .filter(segment -> nodeId.equals(segment.startNodeId()) || nodeId.equals(segment.endNodeId()))
                .toList();
    }

    public List<CorridorNode> persistedManualNodes() {
        return nodes.stream()
                .filter(node -> node.nodeId() != null && !node.isDoorBound())
                .toList();
    }

    public long nextSyntheticNodeId() {
        long min = -1L;
        for (CorridorNode node : nodes) {
            if (node != null && node.nodeId() != null) {
                min = Math.min(min, node.nodeId());
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    public long nextSyntheticSegmentId() {
        long min = -1L;
        for (CorridorSegment segment : segments) {
            if (segment != null && segment.segmentId() != null) {
                min = Math.min(min, segment.segmentId());
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    private Corridor resolvedAgainst(CorridorResolutionInput input, List<CorridorNode> updatedNodes, List<CorridorSegment> updatedSegments) {
        return resolvedAgainst(input, updatedNodes, updatedSegments, boundaryAtLevel(levelZ).doors());
    }

    private Corridor resolvedAgainst(
            CorridorResolutionInput input,
            List<CorridorNode> updatedNodes,
            List<CorridorSegment> updatedSegments,
            Collection<Door> updatedDoors
    ) {
        CorridorSpecification updatedSpecification = new CorridorSpecification(
                corridorId,
                structureObjectId,
                mapId,
                levelZ,
                updatedNodes,
                updatedSegments);
        return Corridor.fromSpecification(updatedSpecification, requireInput(levelZ, input).withDoors(updatedDoors));
    }

    private static CorridorPathTrace traceForSegment(Corridor corridor, Long segmentId) {
        if (corridor == null || segmentId == null) {
            return null;
        }
        return corridor.pathTraces().stream()
                .filter(trace -> trace != null && Objects.equals(trace.traceId(), segmentId))
                .findFirst()
                .orElse(null);
    }

    private static Long otherNodeId(CorridorSegment segment, Long nodeId) {
        if (segment == null || nodeId == null) {
            return null;
        }
        if (Objects.equals(segment.startNodeId(), nodeId)) {
            return segment.endNodeId();
        }
        if (Objects.equals(segment.endNodeId(), nodeId)) {
            return segment.startNodeId();
        }
        return null;
    }

    private CorridorTopologyUpdate topologyAfterRemoval(Set<Long> removedNodeIds, Set<Long> removedSegmentIds) {
        LinkedHashSet<Long> resolvedNodeIds = removedNodeIds == null
                ? new LinkedHashSet<>()
                : new LinkedHashSet<>(removedNodeIds);
        LinkedHashSet<Long> resolvedSegmentIds = removedSegmentIds == null
                ? new LinkedHashSet<>()
                : new LinkedHashSet<>(removedSegmentIds);
        ArrayList<CorridorSegment> remainingSegments = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            if (segment == null
                    || resolvedSegmentIds.contains(segment.segmentId())
                    || resolvedNodeIds.contains(segment.startNodeId())
                    || resolvedNodeIds.contains(segment.endNodeId())) {
                continue;
            }
            remainingSegments.add(segment);
        }
        boolean changed = remainingSegments.size() != segments.size() || !resolvedNodeIds.isEmpty();
        if (!changed) {
            return CorridorTopologyUpdate.unchanged();
        }
        return new CorridorTopologyUpdate(true, corridorComponents(remainingSegments, resolvedNodeIds));
    }

    private List<CorridorComponent> corridorComponents(List<CorridorSegment> remainingSegments, Set<Long> removedNodeIds) {
        if (remainingSegments == null || remainingSegments.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<Long, List<CorridorSegment>> segmentsByNodeId = new LinkedHashMap<>();
        for (CorridorSegment segment : remainingSegments) {
            segmentsByNodeId.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment);
            segmentsByNodeId.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment);
        }
        ArrayList<CorridorComponent> result = new ArrayList<>();
        LinkedHashSet<Long> visitedNodeIds = new LinkedHashSet<>();
        for (CorridorNode startNode : nodes) {
            if (startNode == null
                    || startNode.nodeId() == null
                    || (removedNodeIds != null && removedNodeIds.contains(startNode.nodeId()))
                    || !segmentsByNodeId.containsKey(startNode.nodeId())
                    || !visitedNodeIds.add(startNode.nodeId())) {
                continue;
            }
            LinkedHashSet<Long> componentNodeIds = new LinkedHashSet<>();
            ArrayDeque<Long> frontier = new ArrayDeque<>();
            frontier.add(startNode.nodeId());
            while (!frontier.isEmpty()) {
                Long currentNodeId = frontier.removeFirst();
                componentNodeIds.add(currentNodeId);
                for (CorridorSegment segment : segmentsByNodeId.getOrDefault(currentNodeId, List.of())) {
                    Long otherNodeId = otherNodeId(segment, currentNodeId);
                    if (otherNodeId != null && visitedNodeIds.add(otherNodeId)) {
                        frontier.addLast(otherNodeId);
                    }
                }
            }

            ArrayList<CorridorNode> componentNodes = new ArrayList<>();
            for (CorridorNode node : nodes) {
                if (node != null && componentNodeIds.contains(node.nodeId())) {
                    componentNodes.add(node);
                }
            }
            ArrayList<CorridorSegment> componentSegments = new ArrayList<>();
            for (CorridorSegment segment : remainingSegments) {
                if (componentNodeIds.contains(segment.startNodeId()) && componentNodeIds.contains(segment.endNodeId())) {
                    componentSegments.add(segment);
                }
            }
            if (!componentSegments.isEmpty()) {
                result.add(new CorridorComponent(
                        componentNodes,
                        componentSegments,
                        componentDoors(componentSegments)));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private List<Door> componentDoors(List<CorridorSegment> componentSegments) {
        List<Door> doors = boundaryAtLevel(levelZ).doors();
        if (componentSegments == null || componentSegments.isEmpty() || doors.isEmpty()) {
            return List.of();
        }
        Set<Long> componentSegmentIds = componentSegments.stream()
                .map(CorridorSegment::segmentId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Set<GridPoint> componentCells = CorridorRouting.surfaceCellsForTraces(pathTraces.stream()
                .filter(trace -> trace != null && componentSegmentIds.contains(trace.traceId()))
                .toList());
        if (componentCells.isEmpty()) {
            return List.of();
        }
        return doors.stream()
                .filter(Objects::nonNull)
                .filter(door -> door.touchesAnyCell(features.world.dungeon.geometry.GridArea.of(componentCells)))
                .toList();
    }

    private static void validateTopology(List<CorridorNode> nodes, List<CorridorSegment> segments) {
        Map<Long, CorridorNode> nodesById = indexNodes(nodes);
        LinkedHashMap<Long, Integer> degreeByNodeId = new LinkedHashMap<>();
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
            if (node == null || node.nodeId() == null) {
                throw new IllegalArgumentException("Corridor nodes require stable ids");
            }
            degreeByNodeId.put(node.nodeId(), 0);
        }
        for (CorridorSegment segment : segments == null ? List.<CorridorSegment>of() : segments) {
            if (!nodesById.containsKey(segment.startNodeId()) || !nodesById.containsKey(segment.endNodeId())) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            degreeByNodeId.computeIfPresent(segment.startNodeId(), (ignored, degree) -> degree + 1);
            degreeByNodeId.computeIfPresent(segment.endNodeId(), (ignored, degree) -> degree + 1);
        }
        Long startNodeId = null;
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
            int degree = degreeByNodeId.getOrDefault(node.nodeId(), 0);
            if (degree <= 0) {
                throw new IllegalArgumentException("Corridor nodes may not be isolated");
            }
            if (node.isDoorBound() && degree != 1) {
                throw new IllegalArgumentException("Door-bound corridor nodes must have degree 1");
            }
            if (startNodeId == null) {
                startNodeId = node.nodeId();
            }
        }
        validateConnectedGraph(segments, degreeByNodeId.keySet(), startNodeId);
    }

    private static void validateConnectedGraph(List<CorridorSegment> segments, Set<Long> nodeIds, Long startNodeId) {
        if (segments == null || segments.isEmpty() || nodeIds == null || nodeIds.isEmpty() || startNodeId == null) {
            return;
        }
        LinkedHashMap<Long, List<Long>> adjacency = new LinkedHashMap<>();
        for (Long nodeId : nodeIds) {
            adjacency.put(nodeId, new ArrayList<>());
        }
        for (CorridorSegment segment : segments) {
            adjacency.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment.endNodeId());
            adjacency.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment.startNodeId());
        }
        LinkedHashSet<Long> visitedNodeIds = new LinkedHashSet<>();
        ArrayDeque<Long> frontier = new ArrayDeque<>();
        frontier.add(startNodeId);
        visitedNodeIds.add(startNodeId);
        while (!frontier.isEmpty()) {
            Long nodeId = frontier.removeFirst();
            for (Long neighborNodeId : adjacency.getOrDefault(nodeId, List.of())) {
                if (visitedNodeIds.add(neighborNodeId)) {
                    frontier.addLast(neighborNodeId);
                }
            }
        }
        if (visitedNodeIds.size() != nodeIds.size()) {
            throw new IllegalArgumentException("Corridor graph must stay connected");
        }
    }

    private static void addUniqueSegment(
            List<CorridorSegment> target,
            Set<String> seenEdges,
            CorridorSegment segment
    ) {
        if (target == null || seenEdges == null || segment == null) {
            return;
        }
        String edgeKey = segment.startNodeId() + ":" + segment.endNodeId();
        if (seenEdges.add(edgeKey)) {
            target.add(segment);
        }
    }

    private static List<CorridorNode> normalizeNodes(CorridorResolutionInput input, int levelZ, List<CorridorNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        ArrayList<CorridorNode> result = new ArrayList<>();
        Set<Long> seenIds = new LinkedHashSet<>();
        Set<Long> seenCoordinates = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null) {
                continue;
            }
            CorridorNode resolvedNode = canonicalizeDoorBoundNode(node, levelZ, input);
            if (node.nodeId() != null && !seenIds.add(node.nodeId())) {
                throw new IllegalArgumentException("Duplicate corridor node id " + node.nodeId());
            }
            long coordinateKey = 31L * (31L * resolvedNode.point().x2() + resolvedNode.point().y2()) + resolvedNode.point().z();
            if (!seenCoordinates.add(coordinateKey)) {
                throw new IllegalArgumentException("Duplicate corridor node coordinates");
            }
            result.add(resolvedNode);
        }
        if (result.size() < 2) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        result.sort(Comparator
                .comparing((CorridorNode node) -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId())
                .thenComparing(CorridorNode::point, GridPoint.ORDER));
        return List.copyOf(result);
    }

    private static List<CorridorSegment> normalizeSegments(List<CorridorSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        ArrayList<CorridorSegment> result = new ArrayList<>();
        Set<String> seenEdges = new LinkedHashSet<>();
        for (CorridorSegment segment : segments) {
            if (segment == null) {
                continue;
            }
            String edgeKey = segment.startNodeId() + ":" + segment.endNodeId();
            if (!seenEdges.add(edgeKey)) {
                throw new IllegalArgumentException("Duplicate corridor segment " + edgeKey);
            }
            result.add(segment);
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        result.sort(Comparator
                .comparing((CorridorSegment segment) -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId())
                .thenComparing(CorridorSegment::startNodeId)
                .thenComparing(CorridorSegment::endNodeId));
        return List.copyOf(result);
    }

    private static DerivedProjection deriveProjection(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            CorridorResolutionInput input
    ) {
        CorridorResolutionInput resolvedInput = requireInput(levelZ, input);
        Set<GridPoint> blockedCells = resolvedInput.blockedCells();
        GridArea blockedArea = GridArea.of(blockedCells);
        List<CorridorRouting.RoutedNode> routedNodes = nodes.stream()
                .map(node -> routedNode(resolvedInput, node, levelZ, blockedArea))
                .toList();
        List<CorridorRouting.RoutedLink> routedLinks = segments.stream()
                .filter(Objects::nonNull)
                .map(segment -> new CorridorRouting.RoutedLink(segment.segmentId(), segment.startNodeId(), segment.endNodeId()))
                .toList();
        CorridorRouting.RoutedProjection routedProjection = CorridorRouting.routeSurfaceProjection(
                levelZ,
                routedNodes,
                routedLinks,
                blockedArea);
        Structure structure = structureWithResolvedDoors(routedProjection.structure(), levelZ, resolvedInput.corridorDoors());
        return new DerivedProjection(
                structure,
                routedProjection.traces(),
                materializeConnections(resolvedInput, corridorId, mapId, levelZ, nodes));
    }

    private static Structure structureWithResolvedDoors(
            Structure routedStructure,
            int levelZ,
            Collection<Door> doors
    ) {
        if (routedStructure == null || routedStructure.surfaceAtLevel(levelZ).isEmpty()) {
            return Structure.empty();
        }
        StructureBoundary boundary = routedStructure.boundaryAtLevel(levelZ);
        return Structure.fromSpecification(StructureSpecification.ofLevel(
                levelZ,
                new StructureSpecification.LevelSpecification(
                        routedStructure.surfaceAtLevel(levelZ).surface().anchorCell(),
                        features.world.dungeon.geometry.GridArea.of(routedStructure.surfaceAtLevel(levelZ).surface().cells()),
                        features.world.dungeon.geometry.GridArea.of(routedStructure.surfaceAtLevel(levelZ).floor().cells()),
                        doors == null ? List.of() : List.copyOf(doors),
                        boundary.walls())));
    }

    private static CorridorNode canonicalizeDoorBoundNode(CorridorNode node, int levelZ, CorridorResolutionInput input) {
        if (node == null || !node.isDoorBound()) {
            return node;
        }
        GridPoint anchorPoint = doorAnchorPoint(node, levelZ, input);
        return anchorPoint.equals(node.point())
                ? node
                : new CorridorNode(node.nodeId(), anchorPoint, node.doorRef());
    }

    private static Map<Long, CorridorNode> indexNodes(List<CorridorNode> nodes) {
        Map<Long, CorridorNode> result = new LinkedHashMap<>();
        long syntheticId = -1L;
        for (CorridorNode node : nodes) {
            long nodeId = node.nodeId() == null ? syntheticId-- : node.nodeId();
            result.put(nodeId, node);
        }
        return Map.copyOf(result);
    }

    private static CorridorRouting.RoutedNode routedNode(
            CorridorResolutionInput input,
            CorridorNode node,
            int levelZ,
            GridArea blockedCells
    ) {
        if (node == null || node.nodeId() == null) {
            throw new IllegalArgumentException("Corridor routed node requires a stable id");
        }
        return new CorridorRouting.RoutedNode(node.nodeId(), attachmentsForNode(input, node, levelZ, blockedCells));
    }

    private static List<CorridorRouting.AnchorAttachment> attachmentsForNode(
            CorridorResolutionInput input,
            CorridorNode node,
            int levelZ,
            GridArea blockedCells
    ) {
        if (node == null) {
            return List.of();
        }
        if (node.isDoorBound()) {
            CorridorResolutionInput.ExteriorDoorInput door = requiredExteriorDoor(input, node.doorRef());
            return List.of(new CorridorRouting.AnchorAttachment(
                    door.exteriorCell(),
                    List.of(door.anchorPoint(), door.exteriorCell())));
        }
        return CorridorRouting.attachmentsForPoint(node.point(), blockedCells);
    }

    private static List<DungeonConnection> materializeConnections(
            CorridorResolutionInput input,
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes
    ) {
        if (corridorId == null) {
            return List.of();
        }
        ArrayList<DungeonConnection> result = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (!node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
            result.add(new DungeonConnection(
                    ConnectionKind.CORRIDOR,
                    corridorId,
                    mapId,
                    levelZ,
                    new DoorConnectionCarrier(description.ref()),
                    List.of(ConnectionEndpoint.room(description.roomId()), ConnectionEndpoint.corridor(corridorId))));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static GridPoint doorAnchorPoint(CorridorNode node, int levelZ, CorridorResolutionInput input) {
        GridSegment boundaryEdge = doorBoundaryEdge(node, levelZ, input);
        return boundaryEdge == null ? null : boundaryEdge.midpoint();
    }

    private static boolean shouldRebindNode(
            Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> doorsByRef,
            CorridorNode node,
            Set<Long> affectedRoomIds
    ) {
        if (doorsByRef == null || node == null || !node.isDoorBound() || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return false;
        }
        CorridorResolutionInput.ExteriorDoorInput description = doorsByRef.get(node.doorRef());
        if (description == null) {
            return false;
        }
        return description.roomId() != null && affectedRoomIds.contains(description.roomId());
    }

    private static DoorRewriteBinding resolveDoorRewriteBinding(
            CorridorReconcileInput input,
            CorridorNode node,
            boolean requirePersistedRoomId
    ) {
        if (input == null || node == null || !node.isDoorBound()) {
            throw new IllegalArgumentException("Corridor room rewrite requires a door-bound node");
        }
        CorridorResolutionInput.ExteriorDoorInput originalDoor = input.originalDoorsByRef().get(node.doorRef());
        CorridorResolutionInput.ExteriorDoorInput reboundDoor = input.updatedDoorsByRef().get(node.doorRef());
        if (originalDoor == null || reboundDoor == null) {
            throw new IllegalArgumentException("Corridor room rewrite requires an existing exterior room door");
        }
        if (requirePersistedRoomId && reboundDoor.roomId() == null) {
            throw new IllegalArgumentException(
                    "Corridor node rebound requires a persisted room id at level " + input.updatedResolution().levelZ());
        }
        return new DoorRewriteBinding(reboundDoor.ref(), reboundDoor.anchorPoint());
    }

    private static GridSegment doorBoundaryEdge(CorridorNode node, int levelZ, CorridorResolutionInput input) {
        CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node == null ? null : node.doorRef());
        return description.anchorSegment();
    }

    private static CorridorResolutionInput.ExteriorDoorInput requiredExteriorDoor(
            CorridorResolutionInput input,
            DoorRef doorRef
    ) {
        return Objects.requireNonNull(input, "input").requiredExteriorDoor(doorRef);
    }

    private static Set<GridSegment> doorSegments(Collection<Door> doors) {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (Door door : doors == null ? List.<Door>of() : doors) {
            if (door != null) {
                result.addAll(door.boundarySegments());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private record DerivedProjection(
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections
    ) {
    }

    public record CorridorTopologyUpdate(boolean changed, List<CorridorComponent> components) {
        public CorridorTopologyUpdate {
            components = components == null ? List.of() : List.copyOf(components);
        }

        public static CorridorTopologyUpdate unchanged() {
            return new CorridorTopologyUpdate(false, List.of());
        }
    }

    public record CorridorComponent(
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            List<Door> doors
    ) {
        public CorridorComponent {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
            segments = segments == null ? List.of() : List.copyOf(segments);
            doors = doors == null ? List.of() : List.copyOf(doors);
        }
    }

    private record DoorRewriteBinding(
            DoorRef doorRef,
            GridPoint anchorPoint
    ) {
    }
}
