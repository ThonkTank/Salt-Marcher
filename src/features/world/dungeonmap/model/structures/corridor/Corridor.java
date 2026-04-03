package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * Corridors are edited and persisted as standalone structures.
 *
 * <p>The behavior to preserve here is: the graph is canonical, shared structure geometry is derived from it, room
 * attachments stay explicit, and callers must get the same corridor behavior without any second aggregate owner.
 */
public final class Corridor {

    private static final int ROUTE_MARGIN = 4;

    private final Long corridorId;
    private final long mapId;
    private final int levelZ;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final StructureObject structure;
    private final List<CorridorRoute> routes;
    private final List<CorridorConnection> connections;

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, roomsById);
    }

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Room> rooms
    ) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, indexRoomsById(rooms));
    }

    public static Corridor planned(
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        return new Corridor(null, mapId, levelZ, nodes, segments, roomsById);
    }

    public static Corridor planned(
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Room> rooms
    ) {
        return new Corridor(null, mapId, levelZ, nodes, segments, indexRoomsById(rooms));
    }

    private Corridor(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        Map<Long, Room> resolvedRooms = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.levelZ = levelZ;
        this.nodes = normalizeNodes(levelZ, nodes, resolvedRooms);
        this.segments = normalizeSegments(segments);
        DerivedProjection projection = deriveProjection(corridorId, mapId, levelZ, this.nodes, this.segments, resolvedRooms);
        this.structure = projection.structure();
        this.routes = projection.routes();
        this.connections = projection.connections();
    }

    public Corridor withIdentity(Long corridorId, long mapId, Map<Long, Room> roomsById) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, roomsById);
    }

    public Corridor withIdentity(Long corridorId, long mapId, Collection<Room> rooms) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, indexRoomsById(rooms));
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

    public List<CorridorRoute> routes() {
        return routes;
    }

    public List<CorridorConnection> connections() {
        return connections;
    }

    public Corridor movedNode(DungeonLayout layout, Long nodeId, GridPoint2x point2x) {
        if (layout == null || nodeId == null || point2x == null) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (node == null) {
                continue;
            }
            if (!nodeId.equals(node.nodeId())) {
                updatedNodes.add(node);
                continue;
            }
            updatedNodes.add(new CorridorNode(
                    node.nodeId(),
                    point2x,
                    node.roomId(),
                    node.roomCell(),
                    node.roomBoundaryDirection()));
        }
        return resolvedAgainst(layout, updatedNodes, segments);
    }

    public Corridor insertedNode(DungeonLayout layout, Long segmentId, GridPoint2x point2x) {
        if (layout == null || segmentId == null || point2x == null) {
            return this;
        }
        CorridorSegment target = findSegment(segmentId);
        if (target == null) {
            return this;
        }
        long nodeId = nextSyntheticNodeId();
        long segmentStartId = nextSyntheticSegmentId();
        long segmentEndId = segmentStartId - 1;
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes);
        updatedNodes.add(new CorridorNode(nodeId, point2x, null, null, null));
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            if (!Objects.equals(segment.segmentId(), segmentId)) {
                updatedSegments.add(segment);
                continue;
            }
            updatedSegments.add(new CorridorSegment(segmentStartId, segment.startNodeId(), nodeId));
            updatedSegments.add(new CorridorSegment(segmentEndId, nodeId, segment.endNodeId()));
        }
        return resolvedAgainst(layout, updatedNodes, updatedSegments);
    }

    public Corridor deletedNode(DungeonLayout layout, Long nodeId) {
        if (layout == null || nodeId == null) {
            return this;
        }
        CorridorNode removed = findNode(nodeId);
        if (removed == null || removed.isRoomBound()) {
            return this;
        }
        List<CorridorSegment> touchingSegments = segmentsForNode(nodeId);
        if (touchingSegments.isEmpty() || touchingSegments.size() > 2) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (node != null && !nodeId.equals(node.nodeId())) {
                updatedNodes.add(node);
            }
        }
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            if (segment == null || nodeId.equals(segment.startNodeId()) || nodeId.equals(segment.endNodeId())) {
                continue;
            }
            updatedSegments.add(segment);
        }
        if (touchingSegments.size() == 2) {
            Long firstNeighbor = touchingSegments.getFirst().startNodeId().equals(nodeId)
                    ? touchingSegments.getFirst().endNodeId()
                    : touchingSegments.getFirst().startNodeId();
            Long secondNeighbor = touchingSegments.getLast().startNodeId().equals(nodeId)
                    ? touchingSegments.getLast().endNodeId()
                    : touchingSegments.getLast().startNodeId();
            updatedSegments.add(new CorridorSegment(nextSyntheticSegmentId(), firstNeighbor, secondNeighbor));
        }
        return resolvedAgainst(layout, updatedNodes, updatedSegments);
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
            } else if (node != null && translate && levelDelta == 0 && !node.isRoomBound()) {
                // Move previews and persisted cluster moves use the same free-node seed so the later room-relative
                // rebind step starts from corridor geometry that already follows the moved room instead of pinning
                // manual nodes to stale absolute anchors.
                updatedNode = new CorridorNode(
                        node.nodeId(),
                        node.point2x().translatedByCells(delta),
                        null,
                        null,
                        null);
            }
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        if (!changed) {
            return this;
        }
        Corridor adjustedCorridor = resolvedAgainst(layout, updatedNodes, segments);
        return levelDelta == 0 && translate
                ? adjustedCorridor.reboundFreeNodesFrom(this, layout)
                : adjustedCorridor;
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
        if (!reboundCorridor.routes().equals(routes)) {
            throw new IllegalArgumentException("Corridor room rewrite may not reroute corridor");
        }
        return reboundCorridor;
    }

    public Corridor branchedFrom(
            DungeonLayout layout,
            Long attachNodeId,
            List<CorridorNode> branchNodes,
            List<CorridorSegment> branchSegments
    ) {
        if (layout == null || attachNodeId == null || branchNodes == null || branchSegments == null) {
            return this;
        }
        if (findNode(attachNodeId) == null) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes);
        for (CorridorNode node : branchNodes) {
            if (node != null) {
                updatedNodes.add(node);
            }
        }
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>(segments);
        for (CorridorSegment segment : branchSegments) {
            if (segment != null) {
                updatedSegments.add(segment);
            }
        }
        return resolvedAgainst(layout, updatedNodes, updatedSegments);
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
        if (layout == null) {
            return this;
        }
        return layout.resolveCorridor(corridorId, levelZ, updatedNodes, updatedSegments);
    }

    private Corridor reboundFreeNodesFrom(Corridor originalCorridor, DungeonLayout layout) {
        if (layout == null || originalCorridor == null) {
            return this;
        }
        List<CorridorNode> originalFreeNodes = originalCorridor.persistedManualNodes();
        if (originalFreeNodes.isEmpty()) {
            return this;
        }

        RouteGraph originalGraph = RouteGraph.from(originalCorridor);
        RouteGraph candidateGraph = RouteGraph.from(this);
        List<FreeNodeRebindDescriptor> originalDescriptors = describeFreeNodes(originalFreeNodes, originalGraph);
        List<RebindCandidate> candidates = describeRebindCandidates(candidateGraph);
        if (originalDescriptors.isEmpty() || candidates.isEmpty()) {
            return this;
        }

        Map<RebindSignatureKey, List<FreeNodeRebindDescriptor>> originalsBySignature = groupFreeNodesBySignature(originalDescriptors);
        Map<RebindSignatureKey, List<RebindCandidate>> candidatesBySignature = groupCandidatesBySignature(candidates);
        Map<RebindDegreeKey, List<RebindCandidate>> candidatesByDegree = groupCandidatesByDegree(candidates);
        Map<Long, GridPoint2x> currentFreePoints = currentFreePointsByNodeId();

        LinkedHashMap<Long, GridPoint2x> reboundPointsByNodeId = new LinkedHashMap<>();
        LinkedHashSet<GridPoint2x> usedCandidatePoints = new LinkedHashSet<>();
        ArrayList<FreeNodeRebindDescriptor> unresolvedDescriptors = new ArrayList<>();

        for (Map.Entry<RebindSignatureKey, List<FreeNodeRebindDescriptor>> entry : originalsBySignature.entrySet()) {
            List<FreeNodeRebindDescriptor> originals = entry.getValue();
            List<RebindCandidate> availableCandidates = availableCandidates(candidatesBySignature.get(entry.getKey()), usedCandidatePoints);
            int matchedCount = Math.min(originals.size(), availableCandidates.size());
            for (int index = 0; index < matchedCount; index++) {
                assignCandidate(reboundPointsByNodeId, usedCandidatePoints, originals.get(index), availableCandidates.get(index));
            }
            for (int index = matchedCount; index < originals.size(); index++) {
                unresolvedDescriptors.add(originals.get(index));
            }
        }

        if (!unresolvedDescriptors.isEmpty()) {
            Map<RebindDegreeKey, List<FreeNodeRebindDescriptor>> unresolvedByDegree = groupFreeNodesByDegree(unresolvedDescriptors);
            for (Map.Entry<RebindDegreeKey, List<FreeNodeRebindDescriptor>> entry : unresolvedByDegree.entrySet()) {
                List<FreeNodeRebindDescriptor> unresolved = entry.getValue();
                List<RebindCandidate> availableCandidates = availableCandidates(candidatesByDegree.get(entry.getKey()), usedCandidatePoints);
                int matchedCount = Math.min(unresolved.size(), availableCandidates.size());
                for (int index = 0; index < matchedCount; index++) {
                    assignCandidate(reboundPointsByNodeId, usedCandidatePoints, unresolved.get(index), availableCandidates.get(index));
                }
                for (int index = matchedCount; index < unresolved.size(); index++) {
                    assignFallbackCandidate(
                            reboundPointsByNodeId,
                            usedCandidatePoints,
                            unresolved.get(index),
                            currentFreePoints,
                            candidatesByDegree);
                }
            }
        }

        ArrayList<CorridorNode> reboundNodes = new ArrayList<>(nodes.size());
        boolean changed = false;
        for (CorridorNode node : nodes) {
            if (node == null || node.isRoomBound() || node.nodeId() == null) {
                reboundNodes.add(node);
                continue;
            }
            GridPoint2x reboundPoint = reboundPointsByNodeId.get(node.nodeId());
            if (reboundPoint == null || reboundPoint.equals(node.point2x())) {
                reboundNodes.add(node);
                continue;
            }
            reboundNodes.add(new CorridorNode(node.nodeId(), reboundPoint, null, null, null));
            changed = true;
        }
        return changed ? resolvedAgainst(layout, reboundNodes, segments) : this;
    }

    private Map<Long, GridPoint2x> currentFreePointsByNodeId() {
        LinkedHashMap<Long, GridPoint2x> result = new LinkedHashMap<>();
        for (CorridorNode node : persistedManualNodes()) {
            result.put(node.nodeId(), node.point2x());
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static void assignCandidate(
            Map<Long, GridPoint2x> reboundPointsByNodeId,
            Set<GridPoint2x> usedCandidatePoints,
            FreeNodeRebindDescriptor descriptor,
            RebindCandidate candidate
    ) {
        if (reboundPointsByNodeId == null || usedCandidatePoints == null || descriptor == null || candidate == null) {
            return;
        }
        usedCandidatePoints.add(candidate.point2x());
        reboundPointsByNodeId.put(descriptor.nodeId(), candidate.point2x());
    }

    private static void assignFallbackCandidate(
            Map<Long, GridPoint2x> reboundPointsByNodeId,
            Set<GridPoint2x> usedCandidatePoints,
            FreeNodeRebindDescriptor descriptor,
            Map<Long, GridPoint2x> currentFreePoints,
            Map<RebindDegreeKey, List<RebindCandidate>> candidatesByDegree
    ) {
        if (reboundPointsByNodeId == null || usedCandidatePoints == null || descriptor == null) {
            return;
        }
        GridPoint2x currentPoint = currentFreePoints == null ? null : currentFreePoints.get(descriptor.nodeId());
        if (currentPoint != null && usedCandidatePoints.add(currentPoint)) {
            reboundPointsByNodeId.put(descriptor.nodeId(), currentPoint);
            return;
        }
        RebindCandidate fallbackCandidate = firstAvailableCandidate(
                candidatesByDegree == null ? null : candidatesByDegree.get(descriptor.degreeKey()),
                usedCandidatePoints);
        if (fallbackCandidate != null) {
            usedCandidatePoints.add(fallbackCandidate.point2x());
            reboundPointsByNodeId.put(descriptor.nodeId(), fallbackCandidate.point2x());
            return;
        }
        if (currentPoint != null) {
            reboundPointsByNodeId.put(descriptor.nodeId(), currentPoint);
            return;
        }
        reboundPointsByNodeId.put(descriptor.nodeId(), descriptor.point2x());
    }

    private static List<FreeNodeRebindDescriptor> describeFreeNodes(List<CorridorNode> freeNodes, RouteGraph graph) {
        if (freeNodes == null || freeNodes.isEmpty() || graph == null) {
            return List.of();
        }
        ArrayList<FreeNodeRebindDescriptor> result = new ArrayList<>();
        for (CorridorNode node : freeNodes) {
            if (node == null || node.nodeId() == null) {
                continue;
            }
            NodeRebindShape shape = nodeRebindShape(graph, node.point2x());
            result.add(new FreeNodeRebindDescriptor(
                    node.nodeId(),
                    node.point2x(),
                    shape.signatureKey(),
                    shape.degreeKey(),
                    graph.distanceVector(node.point2x())));
        }
        result.sort(Corridor::compareFreeNodeDescriptors);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<RebindCandidate> describeRebindCandidates(RouteGraph graph) {
        if (graph == null || graph.adjacency().isEmpty()) {
            return List.of();
        }
        ArrayList<RebindCandidate> result = new ArrayList<>();
        for (GridPoint2x point2x : graph.points()) {
            if (point2x == null || graph.roomBoundPoints().contains(point2x)) {
                continue;
            }
            NodeRebindShape shape = nodeRebindShape(graph, point2x);
            result.add(new RebindCandidate(
                    point2x,
                    shape.signatureKey(),
                    shape.degreeKey(),
                    graph.distanceVector(point2x)));
        }
        result.sort(Corridor::compareCandidates);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static NodeRebindShape nodeRebindShape(RouteGraph graph, GridPoint2x point2x) {
        int degree = graph == null || point2x == null ? 0 : graph.degree(point2x);
        RebindDegreeKey degreeKey = new RebindDegreeKey(point2x == null ? GridPoint2x.Kind.CELL : point2x.kind(), degree);
        return new NodeRebindShape(degreeKey, new RebindSignatureKey(degreeKey, armSignature(graph, point2x)));
    }

    private static ArmSignature armSignature(RouteGraph graph, GridPoint2x point2x) {
        if (graph == null || point2x == null) {
            return new ArmSignature(List.of());
        }
        ArrayList<ArmSignatureEntry> entries = new ArrayList<>();
        for (GridPoint2x neighbor : graph.neighborsOf(point2x)) {
            CardinalDirection direction = travelDirection(point2x, neighbor);
            if (direction == null) {
                continue;
            }
            int length2 = edgeCost(point2x, neighbor);
            GridPoint2x previous = point2x;
            GridPoint2x current = neighbor;
            while (true) {
                ArrayList<GridPoint2x> forwardNeighbors = new ArrayList<>();
                for (GridPoint2x candidate : graph.neighborsOf(current)) {
                    if (!candidate.equals(previous)) {
                        forwardNeighbors.add(candidate);
                    }
                }
                if (graph.roomBoundPoints().contains(current) || graph.degree(current) != 2 || forwardNeighbors.size() != 1) {
                    break;
                }
                GridPoint2x next = forwardNeighbors.getFirst();
                CardinalDirection nextDirection = travelDirection(current, next);
                if (nextDirection != direction) {
                    break;
                }
                length2 += edgeCost(current, next);
                previous = current;
                current = next;
            }
            entries.add(new ArmSignatureEntry(direction, length2));
        }
        entries.sort(Comparator
                .comparingInt((ArmSignatureEntry entry) -> entry.direction().code())
                .thenComparingInt(ArmSignatureEntry::length2));
        return new ArmSignature(entries.isEmpty() ? List.of() : List.copyOf(entries));
    }

    private static CardinalDirection travelDirection(GridPoint2x from, GridPoint2x to) {
        if (from == null || to == null) {
            return null;
        }
        return CardinalDirection.fromDirection(new CellCoord(
                Integer.compare(to.x2(), from.x2()),
                Integer.compare(to.y2(), from.y2())));
    }

    private static int edgeCost(GridPoint2x start, GridPoint2x end) {
        return start == null || end == null ? Integer.MAX_VALUE : start.manhattanDistance2x(end);
    }

    private static Map<RebindSignatureKey, List<FreeNodeRebindDescriptor>> groupFreeNodesBySignature(List<FreeNodeRebindDescriptor> descriptors) {
        LinkedHashMap<RebindSignatureKey, List<FreeNodeRebindDescriptor>> grouped = new LinkedHashMap<>();
        for (FreeNodeRebindDescriptor descriptor : descriptors == null ? List.<FreeNodeRebindDescriptor>of() : descriptors) {
            grouped.computeIfAbsent(descriptor.signatureKey(), ignored -> new ArrayList<>()).add(descriptor);
        }
        return immutableGroupedMap(grouped);
    }

    private static Map<RebindDegreeKey, List<FreeNodeRebindDescriptor>> groupFreeNodesByDegree(List<FreeNodeRebindDescriptor> descriptors) {
        LinkedHashMap<RebindDegreeKey, List<FreeNodeRebindDescriptor>> grouped = new LinkedHashMap<>();
        for (FreeNodeRebindDescriptor descriptor : descriptors == null ? List.<FreeNodeRebindDescriptor>of() : descriptors) {
            grouped.computeIfAbsent(descriptor.degreeKey(), ignored -> new ArrayList<>()).add(descriptor);
        }
        return immutableGroupedMap(grouped);
    }

    private static Map<RebindSignatureKey, List<RebindCandidate>> groupCandidatesBySignature(List<RebindCandidate> candidates) {
        LinkedHashMap<RebindSignatureKey, List<RebindCandidate>> grouped = new LinkedHashMap<>();
        for (RebindCandidate candidate : candidates == null ? List.<RebindCandidate>of() : candidates) {
            grouped.computeIfAbsent(candidate.signatureKey(), ignored -> new ArrayList<>()).add(candidate);
        }
        return immutableGroupedMap(grouped);
    }

    private static Map<RebindDegreeKey, List<RebindCandidate>> groupCandidatesByDegree(List<RebindCandidate> candidates) {
        LinkedHashMap<RebindDegreeKey, List<RebindCandidate>> grouped = new LinkedHashMap<>();
        for (RebindCandidate candidate : candidates == null ? List.<RebindCandidate>of() : candidates) {
            grouped.computeIfAbsent(candidate.degreeKey(), ignored -> new ArrayList<>()).add(candidate);
        }
        return immutableGroupedMap(grouped);
    }

    private static <K, V> Map<K, List<V>> immutableGroupedMap(Map<K, List<V>> grouped) {
        if (grouped == null || grouped.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<K, List<V>> result = new LinkedHashMap<>();
        for (Map.Entry<K, List<V>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<RebindCandidate> availableCandidates(List<RebindCandidate> candidates, Set<GridPoint2x> usedCandidatePoints) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        return candidates.stream()
                .filter(candidate -> candidate != null && !usedCandidatePoints.contains(candidate.point2x()))
                .toList();
    }

    private static RebindCandidate firstAvailableCandidate(List<RebindCandidate> candidates, Set<GridPoint2x> usedCandidatePoints) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        for (RebindCandidate candidate : candidates) {
            if (candidate != null && !usedCandidatePoints.contains(candidate.point2x())) {
                return candidate;
            }
        }
        return null;
    }

    private static int compareFreeNodeDescriptors(FreeNodeRebindDescriptor left, FreeNodeRebindDescriptor right) {
        int distanceCompare = compareDistanceVectors(left.distanceVector(), right.distanceVector());
        if (distanceCompare != 0) {
            return distanceCompare;
        }
        int pointCompare = GridPoint2x.ORDER.compare(left.point2x(), right.point2x());
        if (pointCompare != 0) {
            return pointCompare;
        }
        return Long.compare(left.nodeId() == null ? Long.MAX_VALUE : left.nodeId(), right.nodeId() == null ? Long.MAX_VALUE : right.nodeId());
    }

    private static int compareCandidates(RebindCandidate left, RebindCandidate right) {
        int distanceCompare = compareDistanceVectors(left.distanceVector(), right.distanceVector());
        if (distanceCompare != 0) {
            return distanceCompare;
        }
        return GridPoint2x.ORDER.compare(left.point2x(), right.point2x());
    }

    private static int compareDistanceVectors(List<Integer> left, List<Integer> right) {
        int leftSize = left == null ? 0 : left.size();
        int rightSize = right == null ? 0 : right.size();
        int size = Math.max(leftSize, rightSize);
        for (int index = 0; index < size; index++) {
            int leftValue = index < leftSize ? left.get(index) : Integer.MAX_VALUE;
            int rightValue = index < rightSize ? right.get(index) : Integer.MAX_VALUE;
            if (leftValue != rightValue) {
                return Integer.compare(leftValue, rightValue);
            }
        }
        return 0;
    }

    private static Map<Long, Room> indexRoomsById(Collection<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return Map.of();
        }
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<CorridorNode> normalizeNodes(int levelZ, List<CorridorNode> nodes, Map<Long, Room> roomsById) {
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
            CorridorNode resolvedNode = canonicalizeRoomBoundNode(node, levelZ, roomsById);
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
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        // Keep routing/projection semantics centralized in the canonical corridor owner.
        Map<Long, Room> resolvedRooms = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        Map<Long, CorridorNode> nodesById = indexNodes(nodes);
        ArrayList<CorridorRoute> routes = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            CorridorNode start = nodesById.get(segment.startNodeId());
            CorridorNode end = nodesById.get(segment.endNodeId());
            if (start == null || end == null) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            RoutePlan routePlan = findRoute(levelZ, start, end, resolvedRooms);
            routes.add(new CorridorRoute(segment.segmentId(), segment.startNodeId(), segment.endNodeId(), routePlan.path2x()));
        }
        Set<GridSegment2x> openingSegments2x = corridorOpeningSegments(levelZ, nodes, resolvedRooms);
        return new DerivedProjection(
                compileStructure(levelZ, routes, openingSegments2x),
                routes.isEmpty() ? List.of() : List.copyOf(routes),
                materializeConnections(corridorId, mapId, levelZ, nodes, resolvedRooms));
    }

    private static StructureObject compileStructure(
            int levelZ,
            Collection<CorridorRoute> routes,
            Set<GridSegment2x> openingSegments2x
    ) {
        Set<CellCoord> occupiedCells = occupiedCells(routes);
        if (occupiedCells.isEmpty()) {
            return StructureObject.empty();
        }
        Set<GridSegment2x> boundarySegments2x = boundarySegments(occupiedCells);
        LinkedHashSet<GridSegment2x> validOpenings = new LinkedHashSet<>();
        for (GridSegment2x segment2x : openingSegments2x == null ? Set.<GridSegment2x>of() : openingSegments2x) {
            if (segment2x != null && boundarySegments2x.contains(segment2x)) {
                validOpenings.add(segment2x);
            }
        }
        // Corridor descriptor truth is authored directly from routed 2x paths plus room-opening segments; routing still
        // uses cell paths internally, but shared structure geometry no longer round-trips through generic cell import.
        StructureDescriptor descriptor = new StructureDescriptor(Map.of(levelZ, new StructureDescriptor.LevelDescriptor(
                CellCoord.bestCenter(occupiedCells),
                fillSeeds(occupiedCells),
                boundarySegments2x,
                validOpenings)));
        return StructureObject.fromDescriptor(descriptor);
    }

    private static CorridorNode canonicalizeRoomBoundNode(CorridorNode node, int levelZ, Map<Long, Room> roomsById) {
        if (node == null || !node.isRoomBound()) {
            return node;
        }
        GridPoint2x anchorPoint = roomAnchorPoint(node, levelZ, roomsById);
        return anchorPoint.equals(node.point2x())
                ? node
                : new CorridorNode(node.nodeId(), anchorPoint, node.roomId(), node.roomCell(), node.roomBoundaryDirection());
    }

    private static Set<GridSegment2x> corridorOpeningSegments(
            int levelZ,
            List<CorridorNode> nodes,
            Map<Long, Room> roomsById
    ) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null || !node.isRoomBound() || node.roomBoundaryDirection() == null) {
                continue;
            }
            GridSegment2x boundaryEdge = roomBoundaryEdge(node, levelZ, roomsById);
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

    private static RoutePlan findRoute(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            Map<Long, Room> roomsById
    ) {
        Set<CellCoord> blockedCells = blockedRoomCells(levelZ, roomsById);
        return findAnchoredRoute(levelZ, start, end, blockedCells, roomsById);
    }

    private static Set<CellCoord> blockedRoomCells(int levelZ, Map<Long, Room> roomsById) {
        Set<CellCoord> blocked = new LinkedHashSet<>();
        for (Room room : roomsById.values()) {
            if (room == null) {
                continue;
            }
            blocked.addAll(room.structure().cellCoordsAtLevel(levelZ));
        }
        return Set.copyOf(blocked);
    }

    private static RoutePlan findAnchoredRoute(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            Set<CellCoord> blockedCells,
            Map<Long, Room> roomsById
    ) {
        List<AnchorAttachment> startAttachments = attachmentsForNode(start, levelZ, blockedCells, roomsById);
        List<AnchorAttachment> endAttachments = attachmentsForNode(end, levelZ, blockedCells, roomsById);
        RoutePlan bestPlan = null;
        for (AnchorAttachment startAttachment : startAttachments) {
            for (AnchorAttachment endAttachment : endAttachments) {
                CellRoute cellRoute = findCellRoute(startAttachment.cell(), endAttachment.cell(), blockedCells);
                if (cellRoute == null) {
                    continue;
                }
                List<GridPoint2x> path2x = assemblePath2x(
                        startAttachment.anchorToCellPath(),
                        cellRoute.cells(),
                        endAttachment.anchorToCellPath());
                double totalCost = cellRoute.cost()
                        + startAttachment.adapterCost()
                        + endAttachment.adapterCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(path2x, totalCost);
                }
            }
        }
        if (bestPlan == null) {
            throw new IllegalArgumentException("Corridor segment could not be routed");
        }
        return bestPlan;
    }

    private static List<AnchorAttachment> attachmentsForNode(
            CorridorNode node,
            int levelZ,
            Set<CellCoord> blockedCells,
            Map<Long, Room> roomsById
    ) {
        if (node == null) {
            return List.of();
        }
        if (node.isRoomBound()) {
            CellCoord roomCell = boundRoomCell(node, levelZ, roomsById);
            GridPoint2x anchorPoint = roomAnchorPoint(node, levelZ, roomsById);
            if (roomCell == null || anchorPoint == null || node.roomBoundaryDirection() == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            CellCoord exteriorCell = roomCell.add(node.roomBoundaryDirection().delta());
            return List.of(new AnchorAttachment(
                    exteriorCell,
                    List.of(anchorPoint, GridPoint2x.cell(exteriorCell))));
        }
        GridPoint2x anchorPoint = node.point2x();
        if (anchorPoint.isCell()) {
            return List.of(new AnchorAttachment(anchorPoint.asCell().orElseThrow(), List.of(anchorPoint)));
        }
        List<CellCoord> touchingCells = anchorPoint.touchingCells().stream()
                .sorted(CellCoord.ORDER)
                .toList();
        List<CellCoord> preferredCells = touchingCells.stream()
                .filter(cell -> !blockedCells.contains(cell))
                .toList();
        List<CellCoord> candidateCells = preferredCells.isEmpty() ? touchingCells : preferredCells;
        ArrayList<AnchorAttachment> attachments = new ArrayList<>();
        for (CellCoord cell : candidateCells) {
            for (List<GridPoint2x> adapterPath : adapterPaths(anchorPoint, cell)) {
                attachments.add(new AnchorAttachment(cell, adapterPath));
            }
        }
        return attachments.isEmpty() ? List.of() : List.copyOf(attachments);
    }

    private static CellRoute findCellRoute(CellCoord start, CellCoord end, Set<CellCoord> blockedCells) {
        if (start == null || end == null) {
            return null;
        }
        if (start.equals(end)) {
            return new CellRoute(List.of(start), 0.0d);
        }
        int minX = Math.min(start.x(), end.x());
        int maxX = Math.max(start.x(), end.x());
        int minY = Math.min(start.y(), end.y());
        int maxY = Math.max(start.y(), end.y());
        for (CellCoord blocked : blockedCells) {
            minX = Math.min(minX, blocked.x());
            maxX = Math.max(maxX, blocked.x());
            minY = Math.min(minY, blocked.y());
            maxY = Math.max(maxY, blocked.y());
        }
        minX -= ROUTE_MARGIN;
        maxX += ROUTE_MARGIN;
        minY -= ROUTE_MARGIN;
        maxY += ROUTE_MARGIN;

        double turnPenalty = turnPenalty(start, end);
        Set<CellCoord> effectiveBlocked = new LinkedHashSet<>(blockedCells);
        effectiveBlocked.remove(start);
        effectiveBlocked.remove(end);

        SearchState startState = new SearchState(start, null);
        PriorityQueue<QueueEntry> frontier = new PriorityQueue<>(Comparator.comparingDouble(QueueEntry::estimatedTotalCost));
        Map<SearchState, Double> bestCosts = new HashMap<>();
        Map<SearchState, SearchState> cameFrom = new HashMap<>();
        frontier.add(new QueueEntry(startState, heuristic(start, end)));
        bestCosts.put(startState, 0.0d);

        while (!frontier.isEmpty()) {
            QueueEntry currentEntry = frontier.poll();
            SearchState current = currentEntry.state();
            double currentCost = bestCosts.getOrDefault(current, Double.POSITIVE_INFINITY);
            if (currentEntry.estimatedTotalCost() - heuristic(current.cell(), end) > currentCost + 1e-9) {
                continue;
            }
            if (current.cell().equals(end)) {
                return new CellRoute(reconstructCellPath(cameFrom, current), currentCost);
            }
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = current.cell().add(step);
                if (neighbor.x() < minX || neighbor.x() > maxX || neighbor.y() < minY || neighbor.y() > maxY) {
                    continue;
                }
                if (effectiveBlocked.contains(neighbor)) {
                    continue;
                }
                double nextCost = currentCost + 1.0d;
                if (current.direction() != null && !current.direction().equals(step)) {
                    nextCost += turnPenalty;
                }
                SearchState next = new SearchState(neighbor, step);
                if (nextCost + 1e-9 >= bestCosts.getOrDefault(next, Double.POSITIVE_INFINITY)) {
                    continue;
                }
                bestCosts.put(next, nextCost);
                cameFrom.put(next, current);
                frontier.add(new QueueEntry(next, nextCost + heuristic(neighbor, end)));
            }
        }
        return null;
    }

    private static List<CellCoord> reconstructCellPath(Map<SearchState, SearchState> cameFrom, SearchState endState) {
        ArrayList<CellCoord> path = new ArrayList<>();
        SearchState current = endState;
        path.add(current.cell());
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.add(current.cell());
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static List<GridPoint2x> assemblePath2x(
            List<GridPoint2x> startAdapter,
            List<CellCoord> cellRoute,
            List<GridPoint2x> endAdapter
    ) {
        ArrayList<GridPoint2x> result = new ArrayList<>();
        appendUnique(result, startAdapter);
        appendUnique(result, cellRoute == null ? List.of() : cellRoute.stream().map(GridPoint2x::cell).toList());
        ArrayList<GridPoint2x> reversedEnd = new ArrayList<>(endAdapter == null ? List.of() : endAdapter);
        Collections.reverse(reversedEnd);
        appendUnique(result, reversedEnd);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void appendUnique(List<GridPoint2x> target, List<GridPoint2x> points) {
        if (target == null || points == null) {
            return;
        }
        for (GridPoint2x point : points) {
            if (point == null) {
                continue;
            }
            if (!target.isEmpty() && target.getLast().equals(point)) {
                continue;
            }
            target.add(point);
        }
    }

    private static List<List<GridPoint2x>> adapterPaths(GridPoint2x anchorPoint, CellCoord cell) {
        if (anchorPoint == null || cell == null) {
            return List.of();
        }
        GridPoint2x cellCenter = GridPoint2x.cell(cell);
        if (anchorPoint.equals(cellCenter)) {
            return List.of(List.of(anchorPoint));
        }
        if (anchorPoint.manhattanDistance2x(cellCenter) == 1) {
            return List.of(List.of(anchorPoint, cellCenter));
        }
        GridPoint2x firstMidpoint = GridPoint2x.raw(anchorPoint.x2(), cellCenter.y2());
        GridPoint2x secondMidpoint = GridPoint2x.raw(cellCenter.x2(), anchorPoint.y2());
        return List.of(
                List.of(anchorPoint, firstMidpoint, cellCenter),
                List.of(anchorPoint, secondMidpoint, cellCenter));
    }

    private static double heuristic(CellCoord current, CellCoord end) {
        return current == null || end == null ? 0.0d : current.manhattanDistance(end);
    }

    private static Map<GridPoint2x, List<Integer>> indexDistanceVectors(
            Map<GridPoint2x, Set<GridPoint2x>> adjacency,
            List<RouteEndpoint> endpoints
    ) {
        if (adjacency == null || adjacency.isEmpty()) {
            return Map.of();
        }
        List<RouteEndpoint> resolvedEndpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
        ArrayList<Map<GridPoint2x, Integer>> endpointDistances = new ArrayList<>(resolvedEndpoints.size());
        for (RouteEndpoint endpoint : resolvedEndpoints) {
            endpointDistances.add(shortestPointDistances(adjacency, endpoint.point2x()));
        }
        LinkedHashMap<GridPoint2x, List<Integer>> result = new LinkedHashMap<>();
        for (GridPoint2x point2x : adjacency.keySet()) {
            ArrayList<Integer> distanceVector = new ArrayList<>(endpointDistances.size());
            for (Map<GridPoint2x, Integer> distanceMap : endpointDistances) {
                distanceVector.add(distanceMap.getOrDefault(point2x, Integer.MAX_VALUE));
            }
            result.put(point2x, distanceVector.isEmpty() ? List.of() : List.copyOf(distanceVector));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<GridPoint2x, Integer> shortestPointDistances(
            Map<GridPoint2x, Set<GridPoint2x>> adjacency,
            GridPoint2x start
    ) {
        if (adjacency == null || adjacency.isEmpty() || start == null || !adjacency.containsKey(start)) {
            return Map.of();
        }
        PriorityQueue<PointDistance> frontier = new PriorityQueue<>(Comparator.comparingInt(PointDistance::distance2));
        Map<GridPoint2x, Integer> bestDistances = new HashMap<>();
        frontier.add(new PointDistance(start, 0));
        bestDistances.put(start, 0);
        while (!frontier.isEmpty()) {
            PointDistance current = frontier.poll();
            if (current.distance2() > bestDistances.getOrDefault(current.point2x(), Integer.MAX_VALUE)) {
                continue;
            }
            for (GridPoint2x neighbor : adjacency.getOrDefault(current.point2x(), Set.of())) {
                int nextDistance = current.distance2() + edgeCost(current.point2x(), neighbor);
                if (nextDistance >= bestDistances.getOrDefault(neighbor, Integer.MAX_VALUE)) {
                    continue;
                }
                bestDistances.put(neighbor, nextDistance);
                frontier.add(new PointDistance(neighbor, nextDistance));
            }
        }
        return bestDistances.isEmpty() ? Map.of() : Map.copyOf(bestDistances);
    }

    private static double turnPenalty(CellCoord start, CellCoord end) {
        int cellDistance = Math.max(1, start.manhattanDistance(end));
        return Math.max(0.15d, Math.min(0.75d, 0.75d / Math.sqrt(cellDistance)));
    }

    private static List<CorridorConnection> materializeConnections(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            Map<Long, Room> roomsById
    ) {
        if (corridorId == null) {
            return List.of();
        }
        ArrayList<CorridorConnection> result = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (!node.isRoomBound()) {
                continue;
            }
            GridSegment2x boundaryEdge = roomBoundaryEdge(node, levelZ, roomsById);
            if (boundaryEdge == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            result.add(new CorridorConnection(
                    corridorId,
                    mapId,
                    Door.fromSegments(List.of(boundaryEdge), Door.DoorState.CLOSED),
                    List.of(ConnectionEndpoint.room(node.roomId()), ConnectionEndpoint.corridor(corridorId)),
                    levelZ));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static GridPoint2x roomAnchorPoint(CorridorNode node, int levelZ, Map<Long, Room> roomsById) {
        CellCoord roomCell = boundRoomCell(node, levelZ, roomsById);
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
        Room reboundRoom = layout.roomAtCell(roomCell, levelZ);
        if (reboundRoom == null) {
            throw new IllegalArgumentException("Corridor node no longer references a room cell at level " + levelZ);
        }
        GridSegment2x boundaryEdge = GridSegment2x.boundaryEdge(roomCell, direction);
        if (!reboundRoom.structure().boundaryEdgesAtLevel(levelZ).contains(boundaryEdge)) {
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

    private static GridSegment2x roomBoundaryEdge(CorridorNode node, int levelZ, Map<Long, Room> roomsById) {
        CellCoord roomCell = boundRoomCell(node, levelZ, roomsById);
        CardinalDirection direction = node == null ? null : node.roomBoundaryDirection();
        return roomCell == null || direction == null ? null : GridSegment2x.boundaryEdge(roomCell, direction);
    }

    private static CellCoord boundRoomCell(CorridorNode node, int levelZ, Map<Long, Room> roomsById) {
        if (node == null || !node.isRoomBound()) {
            return null;
        }
        Room room = roomsById.get(node.roomId());
        if (room == null) {
            throw new IllegalArgumentException("Corridor node references missing room " + node.roomId());
        }
        var floor = room.structure().floorAtLevel(levelZ);
        if (floor == null) {
            throw new IllegalArgumentException("Corridor node references room without floor at level " + levelZ);
        }
        if (!room.structure().cellCoordsAtLevel(levelZ).contains(node.roomCell())) {
            throw new IllegalArgumentException("Corridor node references cell outside room at level " + levelZ);
        }
        return node.roomCell();
    }

    private static Set<CellCoord> occupiedCells(Collection<CorridorRoute> routes) {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CorridorRoute route : routes == null ? List.<CorridorRoute>of() : routes) {
            if (route == null) {
                continue;
            }
            for (GridPoint2x point2x : route.path2x()) {
                if (point2x != null) {
                    point2x.asCell().ifPresent(result::add);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment2x> boundarySegments(Set<CellCoord> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : occupiedCells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                if (!occupiedCells.contains(cell.add(step))) {
                    result.add(GridSegment2x.boundaryEdge(cell, CardinalDirection.fromDirection(step)));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<CellCoord> fillSeeds(Set<CellCoord> occupiedCells) {
        return CellCoord.componentCenters(occupiedCells);
    }

    private record DerivedProjection(
            StructureObject structure,
            List<CorridorRoute> routes,
            List<CorridorConnection> connections
    ) {
    }

    private record RoomRewriteBinding(
            Long roomId,
            CellCoord roomCell,
            CardinalDirection direction,
            GridPoint2x anchorPoint
    ) {
    }

    private record RouteGraph(
            Map<GridPoint2x, Set<GridPoint2x>> adjacency,
            Set<GridPoint2x> roomBoundPoints,
            Map<GridPoint2x, List<Integer>> distanceVectors
    ) {
        private RouteGraph {
            adjacency = adjacency == null ? Map.of() : Map.copyOf(adjacency);
            roomBoundPoints = roomBoundPoints == null ? Set.of() : Set.copyOf(roomBoundPoints);
            distanceVectors = distanceVectors == null ? Map.of() : Map.copyOf(distanceVectors);
        }

        private static RouteGraph from(Corridor corridor) {
            if (corridor == null) {
                return new RouteGraph(Map.of(), Set.of(), Map.of());
            }
            LinkedHashMap<GridPoint2x, Set<GridPoint2x>> adjacency = new LinkedHashMap<>();
            for (CorridorRoute route : corridor.routes()) {
                List<GridPoint2x> path2x = route == null ? List.of() : route.path2x();
                for (int index = 1; index < path2x.size(); index++) {
                    GridPoint2x previous = path2x.get(index - 1);
                    GridPoint2x current = path2x.get(index);
                    if (previous == null || current == null || previous.equals(current)) {
                        continue;
                    }
                    adjacency.computeIfAbsent(previous, ignored -> new LinkedHashSet<>()).add(current);
                    adjacency.computeIfAbsent(current, ignored -> new LinkedHashSet<>()).add(previous);
                }
            }

            LinkedHashSet<GridPoint2x> roomBoundPoints = new LinkedHashSet<>();
            ArrayList<RouteEndpoint> endpoints = new ArrayList<>();
            for (CorridorNode node : corridor.nodes()) {
                if (node == null || !node.isRoomBound()) {
                    continue;
                }
                roomBoundPoints.add(node.point2x());
                endpoints.add(new RouteEndpoint(node.roomId(), node.nodeId(), node.point2x()));
            }
            endpoints.sort(Comparator
                    .comparing((RouteEndpoint endpoint) -> endpoint.roomId() == null ? Long.MAX_VALUE : endpoint.roomId())
                    .thenComparing(endpoint -> endpoint.nodeId() == null ? Long.MAX_VALUE : endpoint.nodeId())
                    .thenComparing(RouteEndpoint::point2x, GridPoint2x.ORDER));

            LinkedHashMap<GridPoint2x, Set<GridPoint2x>> immutableAdjacency = new LinkedHashMap<>();
            for (Map.Entry<GridPoint2x, Set<GridPoint2x>> entry : adjacency.entrySet()) {
                immutableAdjacency.put(entry.getKey(), Set.copyOf(entry.getValue()));
            }
            return new RouteGraph(
                    immutableAdjacency,
                    roomBoundPoints,
                    indexDistanceVectors(immutableAdjacency, endpoints));
        }

        private List<GridPoint2x> points() {
            return adjacency.keySet().stream()
                    .sorted(GridPoint2x.ORDER)
                    .toList();
        }

        private List<GridPoint2x> neighborsOf(GridPoint2x point2x) {
            return adjacency.getOrDefault(point2x, Set.of()).stream()
                    .sorted(GridPoint2x.ORDER)
                    .toList();
        }

        private int degree(GridPoint2x point2x) {
            return adjacency.getOrDefault(point2x, Set.of()).size();
        }

        private List<Integer> distanceVector(GridPoint2x point2x) {
            return distanceVectors.getOrDefault(point2x, List.of());
        }
    }

    private record RouteEndpoint(Long roomId, Long nodeId, GridPoint2x point2x) {
    }

    private record NodeRebindShape(
            RebindDegreeKey degreeKey,
            RebindSignatureKey signatureKey
    ) {
    }

    private record RebindDegreeKey(
            GridPoint2x.Kind kind,
            int degree
    ) {
    }

    private record RebindSignatureKey(
            RebindDegreeKey degreeKey,
            ArmSignature armSignature
    ) {
    }

    private record ArmSignature(List<ArmSignatureEntry> entries) {
        private ArmSignature {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }
    }

    private record ArmSignatureEntry(
            CardinalDirection direction,
            int length2
    ) {
        private ArmSignatureEntry {
            direction = Objects.requireNonNull(direction, "direction");
        }
    }

    private record FreeNodeRebindDescriptor(
            Long nodeId,
            GridPoint2x point2x,
            RebindSignatureKey signatureKey,
            RebindDegreeKey degreeKey,
            List<Integer> distanceVector
    ) {
        private FreeNodeRebindDescriptor {
            point2x = Objects.requireNonNull(point2x, "point2x");
            signatureKey = Objects.requireNonNull(signatureKey, "signatureKey");
            degreeKey = Objects.requireNonNull(degreeKey, "degreeKey");
            distanceVector = distanceVector == null ? List.of() : List.copyOf(distanceVector);
        }
    }

    private record RebindCandidate(
            GridPoint2x point2x,
            RebindSignatureKey signatureKey,
            RebindDegreeKey degreeKey,
            List<Integer> distanceVector
    ) {
        private RebindCandidate {
            point2x = Objects.requireNonNull(point2x, "point2x");
            signatureKey = Objects.requireNonNull(signatureKey, "signatureKey");
            degreeKey = Objects.requireNonNull(degreeKey, "degreeKey");
            distanceVector = distanceVector == null ? List.of() : List.copyOf(distanceVector);
        }
    }

    private record PointDistance(GridPoint2x point2x, int distance2) {
        private PointDistance {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }
    }

    private record AnchorAttachment(CellCoord cell, List<GridPoint2x> anchorToCellPath) {
        private AnchorAttachment {
            cell = Objects.requireNonNull(cell, "cell");
            anchorToCellPath = anchorToCellPath == null ? List.of() : List.copyOf(anchorToCellPath);
        }

        private double adapterCost() {
            return Math.max(0, anchorToCellPath.size() - 1);
        }
    }

    private record SearchState(CellCoord cell, CellCoord direction) {
        private SearchState {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    private record QueueEntry(SearchState state, double estimatedTotalCost) {
        private QueueEntry {
            state = Objects.requireNonNull(state, "state");
        }
    }

    private record CellRoute(List<CellCoord> cells, double cost) {
        private CellRoute {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    private record RoutePlan(List<GridPoint2x> path2x, double cost) {
        private RoutePlan {
            path2x = path2x == null ? List.of() : List.copyOf(path2x);
        }
    }

    public record CorridorRoute(
            Long segmentId,
            Long startNodeId,
            Long endNodeId,
            List<GridPoint2x> path2x
    ) {
        public CorridorRoute {
            path2x = path2x == null ? List.of() : List.copyOf(path2x);
        }

        public List<GridSegment2x> segments2x() {
            if (path2x.size() < 2) {
                return List.of();
            }
            ArrayList<GridSegment2x> result = new ArrayList<>();
            for (int index = 1; index < path2x.size(); index++) {
                result.add(new GridSegment2x(path2x.get(index - 1), path2x.get(index)));
            }
            return List.copyOf(result);
        }

        public List<GridPoint2x> cornerPoints2x() {
            if (path2x.size() < 3) {
                return List.of();
            }
            ArrayList<GridPoint2x> result = new ArrayList<>();
            for (int index = 1; index < path2x.size() - 1; index++) {
                GridPoint2x previous = path2x.get(index - 1);
                GridPoint2x current = path2x.get(index);
                GridPoint2x next = path2x.get(index + 1);
                int incomingDx2 = current.x2() - previous.x2();
                int incomingDy2 = current.y2() - previous.y2();
                int outgoingDx2 = next.x2() - current.x2();
                int outgoingDy2 = next.y2() - current.y2();
                if (incomingDx2 != outgoingDx2 || incomingDy2 != outgoingDy2) {
                    result.add(current);
                }
            }
            return List.copyOf(result);
        }
    }
}
