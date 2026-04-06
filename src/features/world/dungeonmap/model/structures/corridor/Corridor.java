package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;

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
    private final Set<GridSegment2x> boundaryDoorSegments;
    private final StructureObject structure;
    private final List<DungeonConnection> connections;

    public static Corridor resolved(
            DungeonLayout layout,
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments
    ) {
        return new Corridor(layout, corridorId, levelZ, nodes, segments, Set.of());
    }

    public static Corridor resolved(
            DungeonLayout layout,
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Set<GridSegment2x> boundaryDoorSegments
    ) {
        return new Corridor(layout, corridorId, levelZ, nodes, segments, boundaryDoorSegments);
    }

    public static Corridor planned(
            DungeonLayout layout,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments
    ) {
        return new Corridor(layout, null, levelZ, nodes, segments, Set.of());
    }

    public static Corridor planned(
            DungeonLayout layout,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Set<GridSegment2x> boundaryDoorSegments
    ) {
        return new Corridor(layout, null, levelZ, nodes, segments, boundaryDoorSegments);
    }

    private Corridor(
            DungeonLayout layout,
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Set<GridSegment2x> boundaryDoorSegments
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
                boundaryDoorSegments);
        this.boundaryDoorSegments = projection.boundaryDoorSegments();
        this.structure = projection.structure();
        this.connections = projection.connections();
    }

    public Corridor withIdentity(DungeonLayout layout, Long corridorId) {
        return new Corridor(layout, corridorId, levelZ, nodes, segments, boundaryDoorSegments);
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

    public Set<GridSegment2x> boundaryDoorSegments() {
        return boundaryDoorSegments;
    }

    public List<Long> connectedRoomIds() {
        return nodes.stream()
                .filter(CorridorNode::isRoomBound)
                .map(CorridorNode::roomId)
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

    public Corridor withBoundaryDoor(DungeonLayout layout, GridSegment2x boundarySegment2x) {
        return withBoundaryDoors(layout, boundarySegment2x == null ? List.of() : List.of(boundarySegment2x), false);
    }

    public Corridor withoutBoundaryDoor(DungeonLayout layout, GridSegment2x boundarySegment2x) {
        return withBoundaryDoors(layout, boundarySegment2x == null ? List.of() : List.of(boundarySegment2x), true);
    }

    public Corridor withBoundaryDoors(DungeonLayout layout, Collection<GridSegment2x> segments2x, boolean deleteDoor) {
        if (layout == null || segments2x == null || segments2x.isEmpty()) {
            return this;
        }
        LinkedHashSet<GridSegment2x> nextBoundaryDoorSegments = new LinkedHashSet<>(boundaryDoorSegments);
        boolean changed = false;
        for (GridSegment2x segment2x : segments2x) {
            if (segment2x == null) {
                continue;
            }
            changed |= deleteDoor
                    ? nextBoundaryDoorSegments.remove(segment2x)
                    : nextBoundaryDoorSegments.add(segment2x);
        }
        if (!changed) {
            return this;
        }
        return resolvedAgainst(layout, nodes, segments, nextBoundaryDoorSegments);
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
            if (nodeId.equals(node.nodeId()) && !node.isRoomBound()) {
                updatedNode = new CorridorNode(node.nodeId(), point2x, null, null, null);
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        return changed ? resolvedAgainst(layout, updatedNodes, segments) : this;
    }

    public Corridor movedDoor(DungeonLayout layout, GridSegment2x sourceBoundarySegment2x, CorridorNode targetRoomNode) {
        if (layout == null || sourceBoundarySegment2x == null || targetRoomNode == null || !targetRoomNode.isRoomBound()) {
            return this;
        }
        CorridorNode sourceNode = findRoomBoundNodeAtBoundary(sourceBoundarySegment2x);
        if (sourceNode == null || sourceNode.nodeId() == null) {
            return this;
        }
        RoomRewriteBinding targetBinding = resolveRoomRewriteBinding(layout, levelZ, targetRoomNode, true);
        if (!Objects.equals(sourceNode.roomId(), targetBinding.roomId())) {
            throw new IllegalArgumentException("Corridor door move must stay on the same room");
        }
        GridSegment2x targetBoundarySegment2x = GridSegment2x.boundaryEdge(targetBinding.roomCell(), targetBinding.direction());
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
                updatedNode = new CorridorNode(
                        node.nodeId(),
                        targetBinding.anchorPoint(),
                        sourceNode.roomId(),
                        targetBinding.roomCell(),
                        targetBinding.direction());
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
        updatedNodes.add(new CorridorNode(newNodeId, tilePoint, null, null, null));
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
        if (layout == null || roomNode == null || !roomNode.isRoomBound() || tileCell == null) {
            return this;
        }
        GridSegment2x boundarySegment2x = roomBoundaryEdge(roomNode);
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
        updatedNodes.add(new CorridorNode(
                newNodeId,
                roomNode.point2x(),
                roomNode.roomId(),
                roomNode.roomCell(),
                roomNode.roomBoundaryDirection()));
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
        if (layout == null || roomNode == null || !roomNode.isRoomBound() || boundarySegment2x == null) {
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
            if (shouldRebindNode(node, movedRoomIds)) {
                if (levelDelta != 0) {
                    updatedNode = new CorridorNode(node.nodeId(), node.point2x(), null, null, null);
                } else {
                    CellCoord movedCell = node.roomCell().add(delta);
                    updatedNode = new CorridorNode(
                            node.nodeId(),
                            GridPoint2x.edgeCenter(movedCell, node.roomBoundaryDirection()),
                            node.roomId(),
                            movedCell,
                            node.roomBoundaryDirection());
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

    public void validateRoomBindingsForRewrite(DungeonLayout layout, Set<Long> affectedRoomIds) {
        if (layout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (CorridorNode node : nodes) {
            if (shouldRebindNode(node, affectedRoomIds)) {
                resolveRoomRewriteBinding(layout, levelZ, node, false);
            }
        }
    }

    public Corridor reboundRoomBindings(DungeonLayout layout, Set<Long> affectedRoomIds) {
        if (layout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            if (!shouldRebindNode(node, affectedRoomIds)) {
                updatedNodes.add(node);
                continue;
            }
            RoomRewriteBinding binding = resolveRoomRewriteBinding(layout, levelZ, node, true);
            CorridorNode updatedNode = new CorridorNode(
                    node.nodeId(),
                    binding.anchorPoint(),
                    binding.roomId(),
                    binding.roomCell(),
                    binding.direction());
            updatedNodes.add(updatedNode);
            changed |= !updatedNode.equals(node);
        }
        if (!changed) {
            return this;
        }
        Corridor reboundCorridor = resolvedAgainst(layout, updatedNodes, segments);
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
                .filter(node -> node != null && !node.isRoomBound() && point2x.equals(node.point2x()))
                .findFirst()
                .orElse(null);
    }

    public CorridorNode findRoomBoundNodeAtBoundary(GridSegment2x boundarySegment2x) {
        if (boundarySegment2x == null) {
            return null;
        }
        return nodes.stream()
                .filter(CorridorNode::isRoomBound)
                .filter(node -> boundarySegment2x.equals(roomBoundaryEdge(node)))
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
                .filter(node -> node.nodeId() != null && !node.isRoomBound())
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
        return resolvedAgainst(layout, updatedNodes, updatedSegments, boundaryDoorSegments);
    }

    private Corridor resolvedAgainst(
            DungeonLayout layout,
            List<CorridorNode> updatedNodes,
            List<CorridorSegment> updatedSegments,
            Set<GridSegment2x> updatedBoundaryDoorSegments
    ) {
        if (layout == null) {
            return this;
        }
        return layout.resolveCorridor(corridorId, levelZ, updatedNodes, updatedSegments, updatedBoundaryDoorSegments);
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
                        componentBoundaryDoorSegments(componentSegments)));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private Set<GridSegment2x> componentBoundaryDoorSegments(List<CorridorSegment> componentSegments) {
        if (componentSegments == null || componentSegments.isEmpty() || boundaryDoorSegments.isEmpty()) {
            return Set.of();
        }
        Set<Long> componentSegmentIds = componentSegments.stream()
                .map(CorridorSegment::segmentId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Set<CellCoord> componentCells = StructureObject.surfaceCellsForTraces(structure.pathTracesAtLevel(levelZ).stream()
                .filter(trace -> trace != null && componentSegmentIds.contains(trace.traceId()))
                .toList());
        if (componentCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment2x : boundaryDoorSegments) {
            if (segment2x == null) {
                continue;
            }
            long touching = segment2x.touchingCells().stream()
                    .filter(componentCells::contains)
                    .count();
            if (touching == 1L) {
                result.add(segment2x);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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
            if (node.isRoomBound() && degree != 1) {
                throw new IllegalArgumentException("Room-bound corridor nodes must have degree 1");
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
            CorridorNode resolvedNode = canonicalizeRoomBoundNode(node, levelZ, layout);
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
            Set<GridSegment2x> boundaryDoorSegments
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
                boundaryDoorSegments);
        return new DerivedProjection(
                routedProjection.structure(),
                materializeConnections(layout, corridorId, mapId, levelZ, nodes),
                routedProjection.boundaryOpeningEdges());
    }

    private static CorridorNode canonicalizeRoomBoundNode(CorridorNode node, int levelZ, DungeonLayout layout) {
        if (node == null || !node.isRoomBound()) {
            return node;
        }
        GridPoint2x anchorPoint = roomAnchorPoint(node, levelZ, layout);
        return anchorPoint.equals(node.point2x())
                ? node
                : new CorridorNode(node.nodeId(), anchorPoint, node.roomId(), node.roomCell(), node.roomBoundaryDirection());
    }

    private static Set<GridSegment2x> corridorOpeningSegments(
            DungeonLayout layout,
            int levelZ,
            List<CorridorNode> nodes
    ) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null || !node.isRoomBound() || node.roomBoundaryDirection() == null) {
                continue;
            }
            GridSegment2x boundaryEdge = roomBoundaryEdge(node, levelZ, layout);
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
        if (node.isRoomBound()) {
            CellCoord roomCell = boundRoomCell(node, levelZ, layout);
            GridPoint2x anchorPoint = roomAnchorPoint(node, levelZ, layout);
            if (roomCell == null || anchorPoint == null || node.roomBoundaryDirection() == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            CellCoord exteriorCell = roomCell.add(node.roomBoundaryDirection().delta());
            return List.of(new StructureObject.AnchorAttachment(
                    exteriorCell,
                    List.of(anchorPoint, GridPoint2x.cell(exteriorCell))));
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
            if (!node.isRoomBound()) {
                continue;
            }
            GridSegment2x boundaryEdge = roomBoundaryEdge(node, levelZ, layout);
            if (boundaryEdge == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            result.add(new DungeonConnection(
                    ConnectionKind.CORRIDOR,
                    corridorId,
                    mapId,
                    levelZ,
                    new DoorConnectionCarrier(
                            EdgeShape.fromBoundarySegments(List.of(boundaryEdge)),
                            boundaryEdge,
                            true),
                    List.of(ConnectionEndpoint.room(node.roomId()), ConnectionEndpoint.corridor(corridorId))));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static GridPoint2x roomAnchorPoint(CorridorNode node, int levelZ, DungeonLayout layout) {
        CellCoord roomCell = boundRoomCell(node, levelZ, layout);
        CardinalDirection direction = node == null ? null : node.roomBoundaryDirection();
        return roomCell == null || direction == null ? null : GridPoint2x.edgeCenter(roomCell, direction);
    }

    private static boolean shouldRebindNode(CorridorNode node, Set<Long> affectedRoomIds) {
        return node != null
                && node.isRoomBound()
                && node.roomId() != null
                && affectedRoomIds != null
                && affectedRoomIds.contains(node.roomId());
    }

    private static RoomRewriteBinding resolveRoomRewriteBinding(
            DungeonLayout layout,
            int levelZ,
            CorridorNode node,
            boolean requirePersistedRoomId
    ) {
        if (layout == null || node == null || !node.isRoomBound()) {
            throw new IllegalArgumentException("Corridor room rewrite requires a room-bound node");
        }
        CellCoord roomCell = node.roomCell();
        CardinalDirection direction = node.roomBoundaryDirection();
        if (roomCell == null || direction == null) {
            throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
        }
        var reboundRoom = layout.roomAtCell(roomCell, levelZ);
        if (reboundRoom == null) {
            throw new IllegalArgumentException("Corridor node no longer references a room cell at level " + levelZ);
        }
        GridSegment2x boundaryEdge = GridSegment2x.boundaryEdge(roomCell, direction);
        if (!layout.roomBoundaryEdgesAtLevel(reboundRoom, levelZ).contains(boundaryEdge)) {
            throw new IllegalArgumentException("Corridor node no longer references an exterior room boundary at level " + levelZ);
        }
        CellCoord exteriorCell = roomCell.add(direction.delta());
        if (layout.roomAtCell(exteriorCell, levelZ) != null) {
            throw new IllegalArgumentException("Corridor node no longer references an exterior room boundary at level " + levelZ);
        }
        if (requirePersistedRoomId && reboundRoom.roomId() == null) {
            throw new IllegalArgumentException("Corridor node rebound requires a persisted room id at level " + levelZ);
        }
        return new RoomRewriteBinding(
                reboundRoom.roomId(),
                roomCell,
                direction,
                GridPoint2x.edgeCenter(roomCell, direction));
    }

    private static GridSegment2x roomBoundaryEdge(CorridorNode node) {
        if (node == null || node.roomCell() == null || node.roomBoundaryDirection() == null) {
            return null;
        }
        return GridSegment2x.boundaryEdge(node.roomCell(), node.roomBoundaryDirection());
    }

    private static GridSegment2x roomBoundaryEdge(CorridorNode node, int levelZ, DungeonLayout layout) {
        CellCoord roomCell = boundRoomCell(node, levelZ, layout);
        CardinalDirection direction = node == null ? null : node.roomBoundaryDirection();
        return roomCell == null || direction == null ? null : GridSegment2x.boundaryEdge(roomCell, direction);
    }

    private static CellCoord boundRoomCell(CorridorNode node, int levelZ, DungeonLayout layout) {
        if (node == null || !node.isRoomBound()) {
            return null;
        }
        var room = layout == null ? null : layout.findRoom(node.roomId());
        if (room == null) {
            throw new IllegalArgumentException("Corridor node references missing room " + node.roomId());
        }
        if (layout.roomFloorCellsAtLevel(room, levelZ).isEmpty()) {
            throw new IllegalArgumentException("Corridor node references room without floor at level " + levelZ);
        }
        if (!layout.roomCellsAtLevel(room, levelZ).contains(node.roomCell())) {
            throw new IllegalArgumentException("Corridor node references cell outside room at level " + levelZ);
        }
        if (!layout.roomHasFloorCell(room, node.roomCell(), levelZ)) {
            throw new IllegalArgumentException("Corridor node references room cell without floor at level " + levelZ);
        }
        return node.roomCell();
    }

    private record DerivedProjection(
            StructureObject structure,
            List<DungeonConnection> connections,
            Set<GridSegment2x> boundaryDoorSegments
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
            Set<GridSegment2x> boundaryDoorSegments
    ) {
        public CorridorComponent {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
            segments = segments == null ? List.of() : List.copyOf(segments);
            boundaryDoorSegments = boundaryDoorSegments == null ? Set.of() : Set.copyOf(boundaryDoorSegments);
        }
    }

    private record RoomRewriteBinding(
            Long roomId,
            CellCoord roomCell,
            CardinalDirection direction,
            GridPoint2x anchorPoint
    ) {
    }
}
