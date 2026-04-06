package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.DoorRef;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;

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
 * <p>The behavior to preserve here is: the graph is canonical, shared structure geometry is derived from it, room
 * attachments stay explicit, and callers must get the same corridor behavior without any second aggregate owner.
 */
public final class Corridor {

    private final Long corridorId;
    private final long mapId;
    private final int levelZ;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final StructureObject structure;
    private final List<DungeonConnection> connections;

    public static Corridor resolved(
            DungeonLayout layout,
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments
    ) {
        return new Corridor(layout, corridorId, levelZ, nodes, segments, List.of());
    }

    public static Corridor resolved(
            DungeonLayout layout,
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        return new Corridor(layout, corridorId, levelZ, nodes, segments, doors);
    }

    public static Corridor planned(
            DungeonLayout layout,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments
    ) {
        return new Corridor(layout, null, levelZ, nodes, segments, List.of());
    }

    public static Corridor planned(
            DungeonLayout layout,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        return new Corridor(layout, null, levelZ, nodes, segments, doors);
    }

    private Corridor(
            DungeonLayout layout,
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        DungeonLayout resolvedLayout = Objects.requireNonNull(layout, "layout");
        this.corridorId = corridorId;
        this.mapId = resolvedLayout.mapId();
        this.levelZ = levelZ;
        this.nodes = normalizeNodes(resolvedLayout, levelZ, nodes);
        this.segments = normalizeSegments(segments);
        validateTopology(this.nodes, this.segments);
        DerivedProjection projection = deriveProjection(
                resolvedLayout,
                corridorId,
                this.mapId,
                levelZ,
                this.nodes,
                this.segments,
                doors);
        this.structure = projection.structure();
        this.connections = projection.connections();
    }

    public Corridor withIdentity(DungeonLayout layout, Long corridorId) {
        return new Corridor(layout, corridorId, levelZ, nodes, segments, structure.doorsAtLevel(levelZ));
    }

    public Long corridorId() {
        return corridorId;
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
                .filter(endpoint -> endpoint != null && endpoint.type() == features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    public StructureObject structure() {
        return structure;
    }

    public List<DungeonConnection> connections() {
        return connections;
    }

    public Corridor withDoors(DungeonLayout layout, Collection<Door> doors) {
        if (layout == null) {
            return this;
        }
        return resolvedAgainst(layout, nodes, segments, doors);
    }

    public Corridor withoutDoor(DungeonLayout layout, GridSegment2x boundarySegment2x) {
        if (layout == null || boundarySegment2x == null) {
            return this;
        }
        ArrayList<Door> nextDoors = new ArrayList<>();
        boolean changed = false;
        for (Door door : structure.doorsAtLevel(levelZ)) {
            if (door == null || door.isEmpty()) {
                continue;
            }
            if (!door.segments2x().contains(boundarySegment2x)) {
                nextDoors.add(door);
                continue;
            }
            EdgeShape remaining = EdgeShape.fromBoundarySegments(door.segments2x()).without(List.of(boundarySegment2x));
            List<EdgeShape> components = remaining.connectedComponents();
            if (components.size() > 1) {
                throw new IllegalArgumentException("Corridor door delete would split an existing door");
            }
            if (!components.isEmpty()) {
                EdgeShape component = components.getFirst();
                nextDoors.add(Door.fromShape(
                        door.doorId(),
                        component,
                        component.contains(door.anchorSegment2x()) ? door.anchorSegment2x() : component.firstSegment2x(),
                        door.doorState()));
            }
            changed = true;
        }
        return changed ? resolvedAgainst(layout, nodes, segments, nextDoors) : this;
    }

    public Corridor movedNode(DungeonLayout layout, Long nodeId, GridPoint2x point2x) {
        if (layout == null || nodeId == null || point2x == null) {
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
        return changed ? resolvedAgainst(layout, updatedNodes, segments) : this;
    }

    public Corridor movedDoor(DungeonLayout layout, GridSegment2x sourceBoundarySegment2x, CorridorNode targetRoomNode) {
        if (layout == null || sourceBoundarySegment2x == null || targetRoomNode == null || !targetRoomNode.isDoorBound()) {
            return this;
        }
        CorridorNode sourceNode = findRoomBoundNodeAtBoundary(sourceBoundarySegment2x);
        if (sourceNode == null || sourceNode.nodeId() == null) {
            return this;
        }
        DungeonLayout.DoorDescription sourceDoor = requiredExteriorDoor(layout, levelZ, sourceNode.doorRef());
        DungeonLayout.DoorDescription targetDoor = requiredExteriorDoor(layout, levelZ, targetRoomNode.doorRef());
        if (!Objects.equals(sourceDoor.roomId(), targetDoor.roomId())) {
            throw new IllegalArgumentException("Corridor door move must stay on the same room");
        }
        GridSegment2x targetBoundarySegment2x = targetDoor.anchorSegment2x();
        if (Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)) {
            return this;
        }
        if (layout.connectionAt(levelZ, targetBoundarySegment2x) != null) {
            throw new IllegalArgumentException("Corridor door move target is already occupied");
        }

        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            CorridorNode updatedNode = node;
            if (Objects.equals(node.nodeId(), sourceNode.nodeId())) {
                updatedNode = new CorridorNode(node.nodeId(), targetDoor.anchorSegment2x().midpoint(), targetDoor.ref());
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        return changed ? resolvedAgainst(layout, updatedNodes, segments) : this;
    }

    public Corridor promotedTileNode(DungeonLayout layout, CellCoord tileCell) {
        if (layout == null || tileCell == null) {
            return this;
        }
        GridPoint2x tilePoint = GridPoint2x.cell(tileCell);
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
            StructureObject.PathTrace trace = traceForSegment(this, segment == null ? null : segment.segmentId());
            if (segment == null || trace == null || !trace.path2x().contains(tilePoint)) {
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
        return resolvedAgainst(layout, updatedNodes, updatedSegments);
    }

    public Corridor promotedTileNodeAndMoved(DungeonLayout layout, CellCoord tileCell, GridPoint2x point2x) {
        if (layout == null || tileCell == null || point2x == null) {
            return this;
        }
        Corridor promoted = promotedTileNode(layout, tileCell);
        CorridorNode promotedNode = promoted.findFreeNodeAtPoint(GridPoint2x.cell(tileCell));
        if (promotedNode == null || Objects.equals(promotedNode.point2x(), point2x)) {
            return promoted;
        }
        return promoted.movedNode(layout, promotedNode.nodeId(), point2x);
    }

    public Corridor attachedRoomNodeAtTile(DungeonLayout layout, CorridorNode roomNode, CellCoord tileCell) {
        if (layout == null || roomNode == null || !roomNode.isDoorBound() || tileCell == null) {
            return this;
        }
        GridSegment2x boundarySegment2x = requiredExteriorDoor(layout, levelZ, roomNode.doorRef()).anchorSegment2x();
        if (boundarySegment2x != null && findRoomBoundNodeAtBoundary(boundarySegment2x) != null) {
            return this;
        }
        Corridor promoted = promotedTileNode(layout, tileCell);
        CorridorNode attachNode = promoted.findFreeNodeAtPoint(GridPoint2x.cell(tileCell));
        if (attachNode == null) {
            throw new IllegalArgumentException("Corridor tile did not resolve to a fixed node");
        }
        long newNodeId = promoted.nextSyntheticNodeId();
        long newSegmentId = promoted.nextSyntheticSegmentId();
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(promoted.nodes);
        updatedNodes.add(new CorridorNode(newNodeId, roomNode.point2x(), roomNode.doorRef()));
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>(promoted.segments);
        updatedSegments.add(new CorridorSegment(newSegmentId, attachNode.nodeId(), newNodeId));
        return promoted.resolvedAgainst(layout, updatedNodes, updatedSegments);
    }

    /**
     * Wall-based attach picks the unique corridor cell behind that boundary so the editor does not own
     * corridor-boundary-to-tile translation policy.
     */
    public Corridor attachedRoomNodeAtBoundary(
            DungeonLayout layout,
            CorridorNode roomNode,
            GridSegment2x boundarySegment2x
    ) {
        if (layout == null || roomNode == null || !roomNode.isDoorBound() || boundarySegment2x == null) {
            return this;
        }
        DungeonLayout.CorridorBoundaryDescription boundary = layout.describeCorridorBoundary(
                new DungeonSelectionRef.CorridorBoundaryRef(corridorId, boundarySegment2x),
                levelZ);
        if (boundary == null || !Objects.equals(boundary.corridor().corridorId(), corridorId)) {
            throw new IllegalArgumentException("Corridor attachment target must be a free corridor wall");
        }
        return attachedRoomNodeAtTile(layout, roomNode, boundary.corridorCell());
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

    public Corridor adjustedForMovedRooms(
            DungeonLayout layout,
            Set<Long> movedRoomIds,
            CellCoord delta,
            int levelDelta
    ) {
        if (layout == null || movedRoomIds == null || movedRoomIds.isEmpty()) {
            return this;
        }
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            CorridorNode updatedNode = node;
            if (shouldRebindNode(layout, node, movedRoomIds)) {
                if (levelDelta != 0) {
                    updatedNode = new CorridorNode(node.nodeId(), node.point2x(), null);
                } else if (node.doorRef() != null) {
                    DungeonLayout.DoorDescription movedDoor = layout.describeDoor(node.doorRef());
                    updatedNode = movedDoor == null
                            ? new CorridorNode(node.nodeId(), node.point2x(), null)
                            : new CorridorNode(node.nodeId(), movedDoor.anchorSegment2x().midpoint(), node.doorRef());
                }
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        if (!changed) {
            return this;
        }
        return resolvedAgainst(layout, updatedNodes, segments);
    }

    public void validateRoomBindingsForRewrite(
            DungeonLayout originalLayout,
            DungeonLayout rewrittenLayout,
            Set<Long> affectedRoomIds
    ) {
        if (originalLayout == null || rewrittenLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (CorridorNode node : nodes) {
            if (shouldRebindNode(originalLayout, node, affectedRoomIds)) {
                resolveDoorRewriteBinding(originalLayout, rewrittenLayout, levelZ, node, false);
            }
        }
    }

    public Corridor reboundRoomBindings(
            DungeonLayout originalLayout,
            DungeonLayout rewrittenLayout,
            Set<Long> affectedRoomIds
    ) {
        if (originalLayout == null || rewrittenLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            if (!shouldRebindNode(originalLayout, node, affectedRoomIds)) {
                updatedNodes.add(node);
                continue;
            }
            DoorRewriteBinding binding = resolveDoorRewriteBinding(originalLayout, rewrittenLayout, levelZ, node, true);
            CorridorNode updatedNode = new CorridorNode(node.nodeId(), binding.anchorPoint(), binding.doorRef());
            updatedNodes.add(updatedNode);
            changed |= !updatedNode.equals(node);
        }
        if (!changed) {
            return this;
        }
        Corridor reboundCorridor = resolvedAgainst(rewrittenLayout, updatedNodes, segments);
        if (!reboundCorridor.structure().pathTracesAtLevel(levelZ).equals(structure.pathTracesAtLevel(levelZ))) {
            throw new IllegalArgumentException("Corridor room rewrite may not reroute corridor");
        }
        return reboundCorridor;
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

    public CorridorNode findFreeNodeAtPoint(GridPoint2x point2x) {
        if (point2x == null) {
            return null;
        }
        return nodes.stream()
                .filter(node -> node != null && !node.isDoorBound() && point2x.equals(node.point2x()))
                .findFirst()
                .orElse(null);
    }

    public CorridorNode findRoomBoundNodeAtBoundary(GridSegment2x boundarySegment2x) {
        if (boundarySegment2x == null) {
            return null;
        }
        return nodes.stream()
                .filter(CorridorNode::isDoorBound)
                .filter(node -> boundarySegment2x.midpoint().equals(node.point2x()))
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

    private Corridor resolvedAgainst(DungeonLayout layout, List<CorridorNode> updatedNodes, List<CorridorSegment> updatedSegments) {
        return resolvedAgainst(layout, updatedNodes, updatedSegments, structure.doorsAtLevel(levelZ));
    }

    private Corridor resolvedAgainst(
            DungeonLayout layout,
            List<CorridorNode> updatedNodes,
            List<CorridorSegment> updatedSegments,
            Collection<Door> updatedDoors
    ) {
        if (layout == null) {
            return this;
        }
        return layout.resolveCorridor(corridorId, levelZ, updatedNodes, updatedSegments, updatedDoors);
    }

    private static StructureObject.PathTrace traceForSegment(Corridor corridor, Long segmentId) {
        if (corridor == null || segmentId == null) {
            return null;
        }
        return corridor.structure().pathTraceAtLevel(corridor.levelZ(), segmentId);
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
        List<Door> doors = structure.doorsAtLevel(levelZ);
        if (componentSegments == null || componentSegments.isEmpty() || doors.isEmpty()) {
            return List.of();
        }
        Set<Long> componentSegmentIds = componentSegments.stream()
                .map(CorridorSegment::segmentId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Set<CellCoord> componentCells = StructureObject.surfaceCellsForTraces(structure.pathTracesAtLevel(levelZ).stream()
                .filter(trace -> trace != null && componentSegmentIds.contains(trace.traceId()))
                .toList());
        if (componentCells.isEmpty()) {
            return List.of();
        }
        return doors.stream()
                .filter(Objects::nonNull)
                .filter(door -> door.segments2x().stream().anyMatch(segment2x ->
                        segment2x.touchingCells().stream().anyMatch(componentCells::contains)))
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

    private static List<CorridorNode> normalizeNodes(DungeonLayout layout, int levelZ, List<CorridorNode> nodes) {
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
            CorridorNode resolvedNode = canonicalizeDoorBoundNode(node, levelZ, layout);
            if (node.nodeId() != null && !seenIds.add(node.nodeId())) {
                throw new IllegalArgumentException("Duplicate corridor node id " + node.nodeId());
            }
            long coordinateKey = resolvedNode.point2x().encodedKey();
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
                .thenComparing(CorridorNode::point2x, GridPoint2x.ORDER));
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
            DungeonLayout layout,
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        Set<CellCoord> blockedCells = blockedRoomCells(layout, levelZ);
        List<StructureObject.RoutedNode> routedNodes = nodes.stream()
                .map(node -> routedNode(layout, node, levelZ, blockedCells))
                .toList();
        List<StructureObject.RoutedLink> routedLinks = segments.stream()
                .filter(Objects::nonNull)
                .map(segment -> new StructureObject.RoutedLink(segment.segmentId(), segment.startNodeId(), segment.endNodeId()))
                .toList();
        StructureObject.RoutedProjection routedProjection = StructureObject.routeSurfaceProjection(
                levelZ,
                routedNodes,
                routedLinks,
                blockedCells,
                corridorOpeningSegments(layout, levelZ, nodes),
                doorSegments(doors));
        StructureObject structure = routedProjection.structure().withDoorsAtLevel(levelZ, doors == null ? List.of() : doors);
        return new DerivedProjection(
                structure,
                materializeConnections(layout, corridorId, mapId, levelZ, nodes));
    }

    private static CorridorNode canonicalizeDoorBoundNode(CorridorNode node, int levelZ, DungeonLayout layout) {
        if (node == null || !node.isDoorBound()) {
            return node;
        }
        GridPoint2x anchorPoint = doorAnchorPoint(node, levelZ, layout);
        return anchorPoint.equals(node.point2x())
                ? node
                : new CorridorNode(node.nodeId(), anchorPoint, node.doorRef());
    }

    private static Set<GridSegment2x> corridorOpeningSegments(
            DungeonLayout layout,
            int levelZ,
            List<CorridorNode> nodes
    ) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            GridSegment2x boundaryEdge = doorBoundaryEdge(node, levelZ, layout);
            if (boundaryEdge == null) {
                continue;
            }
            result.add(boundaryEdge);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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

    private static Set<CellCoord> blockedRoomCells(DungeonLayout layout, int levelZ) {
        Set<CellCoord> blocked = new LinkedHashSet<>();
        if (layout == null) {
            return Set.of();
        }
        for (var room : layout.rooms()) {
            if (room == null) {
                continue;
            }
            blocked.addAll(layout.roomCellsAtLevel(room, levelZ));
        }
        return Set.copyOf(blocked);
    }

    private static StructureObject.RoutedNode routedNode(
            DungeonLayout layout,
            CorridorNode node,
            int levelZ,
            Set<CellCoord> blockedCells
    ) {
        if (node == null || node.nodeId() == null) {
            throw new IllegalArgumentException("Corridor routed node requires a stable id");
        }
        return new StructureObject.RoutedNode(node.nodeId(), attachmentsForNode(layout, node, levelZ, blockedCells));
    }

    private static List<StructureObject.AnchorAttachment> attachmentsForNode(
            DungeonLayout layout,
            CorridorNode node,
            int levelZ,
            Set<CellCoord> blockedCells
    ) {
        if (node == null) {
            return List.of();
        }
        if (node.isDoorBound()) {
            DungeonLayout.RoomBoundaryDescription boundary = requiredExteriorDoorBoundary(layout, levelZ, node.doorRef());
            GridSegment2x boundarySegment2x = requiredExteriorDoor(layout, levelZ, node.doorRef()).anchorSegment2x();
            CellCoord exteriorCell = boundary.roomCell().add(boundary.outwardDirection().delta());
            return List.of(new StructureObject.AnchorAttachment(
                    exteriorCell,
                    List.of(boundarySegment2x.midpoint(), GridPoint2x.cell(exteriorCell))));
        }
        return StructureObject.attachmentsForPoint(node.point2x(), blockedCells);
    }

    private static List<DungeonConnection> materializeConnections(
            DungeonLayout layout,
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
            DungeonLayout.DoorDescription description = requiredExteriorDoor(layout, levelZ, node.doorRef());
            result.add(new DungeonConnection(
                    ConnectionKind.CORRIDOR,
                    corridorId,
                    mapId,
                    levelZ,
                    new DoorConnectionCarrier(description.ref(), description.anchorSegment2x()),
                    List.of(ConnectionEndpoint.room(description.roomId()), ConnectionEndpoint.corridor(corridorId))));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static GridPoint2x doorAnchorPoint(CorridorNode node, int levelZ, DungeonLayout layout) {
        GridSegment2x boundaryEdge = doorBoundaryEdge(node, levelZ, layout);
        return boundaryEdge == null ? null : boundaryEdge.midpoint();
    }

    private static boolean shouldRebindNode(DungeonLayout layout, CorridorNode node, Set<Long> affectedRoomIds) {
        if (layout == null || node == null || !node.isDoorBound() || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return false;
        }
        DungeonLayout.DoorDescription description = layout.describeDoor(node.doorRef());
        if (description == null || description.role() != DungeonLayout.DoorRole.ROOM_EXTERIOR) {
            return false;
        }
        return description.roomId() != null && affectedRoomIds.contains(description.roomId());
    }

    private static DoorRewriteBinding resolveDoorRewriteBinding(
            DungeonLayout originalLayout,
            DungeonLayout rewrittenLayout,
            int levelZ,
            CorridorNode node,
            boolean requirePersistedRoomId
    ) {
        if (originalLayout == null || rewrittenLayout == null || node == null || !node.isDoorBound()) {
            throw new IllegalArgumentException("Corridor room rewrite requires a door-bound node");
        }
        requiredExteriorDoor(originalLayout, levelZ, node.doorRef());
        DungeonLayout.DoorDescription reboundDoor = requiredExteriorDoor(rewrittenLayout, levelZ, node.doorRef());
        if (requirePersistedRoomId && reboundDoor.roomId() == null) {
            throw new IllegalArgumentException("Corridor node rebound requires a persisted room id at level " + levelZ);
        }
        return new DoorRewriteBinding(reboundDoor.ref(), reboundDoor.anchorSegment2x().midpoint());
    }

    private static GridSegment2x doorBoundaryEdge(CorridorNode node, int levelZ, DungeonLayout layout) {
        DungeonLayout.DoorDescription description = requiredExteriorDoor(layout, levelZ, node == null ? null : node.doorRef());
        return description.anchorSegment2x();
    }

    private static DungeonLayout.DoorDescription requiredExteriorDoor(
            DungeonLayout layout,
            int levelZ,
            DoorRef doorRef
    ) {
        DungeonLayout.DoorDescription description = layout == null || doorRef == null ? null : layout.describeDoor(doorRef);
        if (description == null
                || description.levelZ() != levelZ
                || description.role() != DungeonLayout.DoorRole.ROOM_EXTERIOR
                || description.roomId() == null) {
            throw new IllegalArgumentException("Corridor door node must reference an existing exterior room door");
        }
        return description;
    }

    private static DungeonLayout.RoomBoundaryDescription requiredExteriorDoorBoundary(
            DungeonLayout layout,
            int levelZ,
            DoorRef doorRef
    ) {
        DungeonLayout.DoorDescription description = requiredExteriorDoor(layout, levelZ, doorRef);
        DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(
                new DungeonSelectionRef.RoomBoundaryRef(description.roomId(), description.anchorSegment2x()),
                levelZ);
        if (boundary == null || !boundary.exterior()) {
            throw new IllegalArgumentException("Corridor door node must reference an exterior room door");
        }
        return boundary;
    }

    private static Set<GridSegment2x> doorSegments(Collection<Door> doors) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Door door : doors == null ? List.<Door>of() : doors) {
            if (door != null) {
                result.addAll(door.segments2x());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private record DerivedProjection(
            StructureObject structure,
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
            GridPoint2x anchorPoint
    ) {
    }
}
