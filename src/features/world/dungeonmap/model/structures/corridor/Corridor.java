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
        validateTopology(this.nodes, this.segments);
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
            CorridorRoute route = routeForSegment(this, segment == null ? null : segment.segmentId());
            if (segment == null || route == null || !route.path2x().contains(tilePoint)) {
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
        if (!reboundCorridor.routes().equals(routes)) {
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
        if (layout == null) {
            return this;
        }
        return layout.resolveCorridor(corridorId, levelZ, updatedNodes, updatedSegments);
    }

    private Corridor rebindStructuralFreeNodes(Corridor originalCorridor, DungeonLayout layout) {
        List<FreeNodeDescriptor> structuralNodes = structuralFreeNodeDescriptors(originalCorridor);
        if (structuralNodes.isEmpty()) {
            return this;
        }
        Corridor current = this;
        for (FreeNodeDescriptor descriptor : structuralNodes) {
            GridPoint2x reboundPoint = current.bestStructuralCandidatePoint(descriptor, layout);
            if (reboundPoint == null) {
                throw new IllegalArgumentException("Corridor free node " + descriptor.nodeId() + " could not be rebound after room move");
            }
            CorridorNode currentNode = current.findNode(descriptor.nodeId());
            if (currentNode != null && !reboundPoint.equals(currentNode.point2x())) {
                current = current.withNodePoint(layout, descriptor.nodeId(), reboundPoint);
            }
        }
        return current;
    }

    private Corridor repairDegree2Chains(Corridor originalCorridor, DungeonLayout layout) {
        if (layout == null || originalCorridor == null || !hasDegree2FreeNodes(originalCorridor)) {
            return this;
        }
        Set<Long> anchorNodeIds = anchorNodeIds(originalCorridor);
        List<ChainDefinition> chains = chainDefinitions(originalCorridor, anchorNodeIds);
        if (chains.isEmpty()) {
            return this;
        }

        LinkedHashMap<Long, CorridorNode> updatedNodesById = new LinkedHashMap<>();
        for (CorridorNode node : nodes) {
            if (node != null && node.nodeId() != null && anchorNodeIds.contains(node.nodeId())) {
                updatedNodesById.put(node.nodeId(), node);
            }
        }
        LinkedHashSet<Long> usedPointKeys = new LinkedHashSet<>();
        for (CorridorNode node : updatedNodesById.values()) {
            usedPointKeys.add(node.point2x().encodedKey());
        }

        Map<Long, Room> roomsById = indexRoomsById(layout.rooms());
        long nextNodeId = nextSyntheticNodeId();
        long nextSegmentId = nextSyntheticSegmentId();
        ArrayList<CorridorSegment> updatedSegments = new ArrayList<>();

        for (ChainDefinition chain : chains) {
            CorridorNode startAnchor = updatedNodesById.get(chain.startAnchorId());
            CorridorNode endAnchor = updatedNodesById.get(chain.endAnchorId());
            if (startAnchor == null || endAnchor == null) {
                throw new IllegalArgumentException("Corridor chain repair references missing anchor node");
            }

            List<ChainNodeDescriptor> originalDescriptors = originalChainNodeDescriptors(originalCorridor, chain);
            RoutePlan reroutedChain = findRoute(levelZ, startAnchor, endAnchor, roomsById);
            List<PathSlot> slots = chainPathSlots(reroutedChain.path2x());
            ChainPlacement placement = placeChainNodes(originalDescriptors, slots, usedPointKeys, nextNodeId);
            nextNodeId = placement.nextSyntheticNodeId();

            ArrayList<Long> chainNodeIds = new ArrayList<>();
            chainNodeIds.add(chain.startAnchorId());
            for (PlacedChainNode placedNode : placement.nodes()) {
                CorridorNode node = new CorridorNode(placedNode.nodeId(), placedNode.point2x(), null, null, null);
                updatedNodesById.put(placedNode.nodeId(), node);
                chainNodeIds.add(placedNode.nodeId());
            }
            chainNodeIds.add(chain.endAnchorId());

            SegmentAllocation allocation = allocateChainSegmentIds(chain.segmentIds(), chainNodeIds.size() - 1, nextSegmentId);
            nextSegmentId = allocation.nextSyntheticSegmentId();
            for (int index = 0; index < chainNodeIds.size() - 1; index++) {
                updatedSegments.add(new CorridorSegment(
                        allocation.segmentIds().get(index),
                        chainNodeIds.get(index),
                        chainNodeIds.get(index + 1)));
            }
        }

        return resolvedAgainst(layout, new ArrayList<>(updatedNodesById.values()), updatedSegments);
    }

    private Corridor withNodePoint(DungeonLayout layout, Long nodeId, GridPoint2x point2x) {
        if (layout == null || nodeId == null || point2x == null) {
            return this;
        }
        ArrayList<CorridorNode> updatedNodes = new ArrayList<>(nodes.size());
        for (CorridorNode node : nodes) {
            if (node == null || !Objects.equals(node.nodeId(), nodeId)) {
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

    private GridPoint2x bestStructuralCandidatePoint(FreeNodeDescriptor descriptor, DungeonLayout layout) {
        if (descriptor == null || layout == null) {
            return null;
        }
        SearchBounds bounds = structuralSearchBounds(descriptor);
        Set<Long> occupiedPointKeys = occupiedPointKeysExcluding(descriptor.nodeId());
        StructuralCandidate bestCandidate = null;
        for (GridPoint2x candidatePoint : candidatePoints(bounds, descriptor.kind())) {
            if (occupiedPointKeys.contains(candidatePoint.encodedKey())) {
                continue;
            }
            try {
                Corridor candidateCorridor = withNodePoint(layout, descriptor.nodeId(), candidatePoint);
                RoutedNodeDescriptor candidateDescriptor = describeRoutedNode(candidateCorridor, descriptor.nodeId());
                if (candidateDescriptor == null
                        || candidateDescriptor.degree() != descriptor.degree()
                        || !candidateDescriptor.armSignature().equals(descriptor.armSignature())) {
                    continue;
                }
                StructuralCandidate scoredCandidate = new StructuralCandidate(
                        candidatePoint,
                        distanceErrorVector(descriptor.roomDistanceVector(), candidateDescriptor.roomDistanceVector()),
                        incidentRouteCost2(candidateCorridor, descriptor.nodeId()),
                        candidatePoint.manhattanDistance2x(descriptor.point2x()));
                if (bestCandidate == null || compareStructuralCandidates(scoredCandidate, bestCandidate) < 0) {
                    bestCandidate = scoredCandidate;
                }
            } catch (IllegalArgumentException ignored) {
                // Invalid candidates are expected while the search probes the local reroute space.
            }
        }
        return bestCandidate == null ? null : bestCandidate.point2x();
    }

    private SearchBounds structuralSearchBounds(FreeNodeDescriptor descriptor) {
        int minX2 = descriptor.point2x().x2();
        int maxX2 = descriptor.point2x().x2();
        int minY2 = descriptor.point2x().y2();
        int maxY2 = descriptor.point2x().y2();
        for (Long neighborNodeId : descriptor.neighborNodeIds()) {
            CorridorNode neighbor = findNode(neighborNodeId);
            if (neighbor == null) {
                continue;
            }
            minX2 = Math.min(minX2, neighbor.point2x().x2());
            maxX2 = Math.max(maxX2, neighbor.point2x().x2());
            minY2 = Math.min(minY2, neighbor.point2x().y2());
            maxY2 = Math.max(maxY2, neighbor.point2x().y2());
        }
        int margin2 = ROUTE_MARGIN * 2;
        return new SearchBounds(minX2 - margin2, maxX2 + margin2, minY2 - margin2, maxY2 + margin2);
    }

    private Set<Long> occupiedPointKeysExcluding(Long nodeId) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null || Objects.equals(node.nodeId(), nodeId)) {
                continue;
            }
            result.add(node.point2x().encodedKey());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static boolean hasDegree2FreeNodes(Corridor corridor) {
        if (corridor == null) {
            return false;
        }
        for (CorridorNode node : corridor.persistedManualNodes()) {
            if (corridor.segmentDegree(node.nodeId()) == 2) {
                return true;
            }
        }
        return false;
    }

    private static List<FreeNodeDescriptor> structuralFreeNodeDescriptors(Corridor corridor) {
        if (corridor == null) {
            return List.of();
        }
        Map<GridPoint2x, Set<GridPoint2x>> adjacency = routeAdjacency(corridor.routes());
        Set<GridPoint2x> roomBoundPoints = roomBoundPoints(corridor.nodes());
        List<RouteEndpoint> roomEndpoints = roomEndpoints(corridor.nodes());
        ArrayList<FreeNodeDescriptor> result = new ArrayList<>();
        for (CorridorNode node : corridor.persistedManualNodes()) {
            int degree = corridor.segmentDegree(node.nodeId());
            if (degree == 2) {
                continue;
            }
            result.add(new FreeNodeDescriptor(
                    node.nodeId(),
                    node.point2x(),
                    node.point2x().kind(),
                    degree,
                    neighborNodeIds(corridor, node.nodeId()),
                    roomDistanceVector(adjacency, roomEndpoints, node.point2x()),
                    armSignature(adjacency, roomBoundPoints, node.point2x())));
        }
        result.sort((left, right) -> {
            int degreeCompare = Integer.compare(right.degree(), left.degree());
            if (degreeCompare != 0) {
                return degreeCompare;
            }
            int distanceCompare = compareDistanceVectors(left.roomDistanceVector(), right.roomDistanceVector());
            if (distanceCompare != 0) {
                return distanceCompare;
            }
            int pointCompare = GridPoint2x.ORDER.compare(left.point2x(), right.point2x());
            if (pointCompare != 0) {
                return pointCompare;
            }
            long leftId = left.nodeId() == null ? Long.MAX_VALUE : left.nodeId();
            long rightId = right.nodeId() == null ? Long.MAX_VALUE : right.nodeId();
            return Long.compare(leftId, rightId);
        });
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static RoutedNodeDescriptor describeRoutedNode(Corridor corridor, Long nodeId) {
        if (corridor == null || nodeId == null) {
            return null;
        }
        CorridorNode node = corridor.findNode(nodeId);
        if (node == null) {
            return null;
        }
        Map<GridPoint2x, Set<GridPoint2x>> adjacency = routeAdjacency(corridor.routes());
        GridPoint2x point2x = node.point2x();
        if (!adjacency.containsKey(point2x)) {
            return null;
        }
        return new RoutedNodeDescriptor(
                routeDegree(adjacency, point2x),
                roomDistanceVector(adjacency, roomEndpoints(corridor.nodes()), point2x),
                armSignature(adjacency, roomBoundPoints(corridor.nodes()), point2x));
    }

    private int segmentDegree(Long nodeId) {
        return segmentsForNode(nodeId).size();
    }

    private static Set<Long> anchorNodeIds(Corridor corridor) {
        if (corridor == null) {
            return Set.of();
        }
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (CorridorNode node : corridor.nodes()) {
            if (node == null || node.nodeId() == null) {
                continue;
            }
            if (node.isRoomBound() || corridor.segmentDegree(node.nodeId()) != 2) {
                result.add(node.nodeId());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Long> neighborNodeIds(Corridor corridor, Long nodeId) {
        if (corridor == null || nodeId == null) {
            return List.of();
        }
        ArrayList<Long> result = new ArrayList<>();
        for (CorridorSegment segment : corridor.segmentsForNode(nodeId)) {
            Long neighborId = otherNodeId(segment, nodeId);
            if (neighborId != null) {
                result.add(neighborId);
            }
        }
        result.sort(Comparator.nullsLast(Long::compareTo));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<ChainDefinition> chainDefinitions(Corridor corridor, Set<Long> anchorNodeIds) {
        if (corridor == null || anchorNodeIds == null || anchorNodeIds.isEmpty()) {
            return List.of();
        }
        ArrayList<Long> sortedAnchorIds = anchorNodeIds.stream()
                .sorted(Comparator.nullsLast(Long::compareTo))
                .collect(ArrayList::new, List::add, List::addAll);
        LinkedHashSet<Long> visitedSegmentIds = new LinkedHashSet<>();
        ArrayList<ChainDefinition> result = new ArrayList<>();
        for (Long anchorNodeId : sortedAnchorIds) {
            List<CorridorSegment> touchingSegments = corridor.segmentsForNode(anchorNodeId).stream()
                    .sorted(Comparator
                            .comparing((CorridorSegment segment) -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId())
                            .thenComparing(segment -> {
                                Long otherNodeId = otherNodeId(segment, anchorNodeId);
                                return otherNodeId == null ? Long.MAX_VALUE : otherNodeId;
                            }))
                    .toList();
            for (CorridorSegment segment : touchingSegments) {
                if (segment == null || segment.segmentId() == null || visitedSegmentIds.contains(segment.segmentId())) {
                    continue;
                }
                visitedSegmentIds.add(segment.segmentId());
                result.add(traceChain(corridor, anchorNodeId, segment, anchorNodeIds, visitedSegmentIds));
            }
        }
        if (visitedSegmentIds.size() != corridor.segments().size()) {
            throw new IllegalArgumentException("Corridor chain repair requires every segment to terminate at an anchor");
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static ChainDefinition traceChain(
            Corridor corridor,
            Long startAnchorId,
            CorridorSegment firstSegment,
            Set<Long> anchorNodeIds,
            Set<Long> visitedSegmentIds
    ) {
        ArrayList<Long> segmentIds = new ArrayList<>();
        ArrayList<Long> internalNodeIds = new ArrayList<>();
        CorridorSegment currentSegment = firstSegment;
        Long previousNodeId = startAnchorId;
        while (currentSegment != null) {
            segmentIds.add(currentSegment.segmentId());
            Long currentNodeId = otherNodeId(currentSegment, previousNodeId);
            if (currentNodeId == null) {
                throw new IllegalArgumentException("Corridor chain repair references a broken segment");
            }
            if (anchorNodeIds.contains(currentNodeId)) {
                return new ChainDefinition(startAnchorId, currentNodeId, segmentIds, internalNodeIds);
            }
            internalNodeIds.add(currentNodeId);
            ArrayList<CorridorSegment> nextSegments = new ArrayList<>();
            for (CorridorSegment segment : corridor.segmentsForNode(currentNodeId)) {
                if (segment != null && !Objects.equals(segment.segmentId(), currentSegment.segmentId())) {
                    nextSegments.add(segment);
                }
            }
            if (nextSegments.size() != 1 || nextSegments.getFirst().segmentId() == null) {
                throw new IllegalArgumentException("Corridor chain repair requires degree-2 nodes inside chain interiors");
            }
            CorridorSegment nextSegment = nextSegments.getFirst();
            if (!visitedSegmentIds.add(nextSegment.segmentId())) {
                throw new IllegalArgumentException("Corridor chain repair encountered a cycle without an anchor");
            }
            previousNodeId = currentNodeId;
            currentSegment = nextSegment;
        }
        throw new IllegalArgumentException("Corridor chain repair could not resolve a terminating anchor");
    }

    private static List<ChainNodeDescriptor> originalChainNodeDescriptors(Corridor corridor, ChainDefinition chain) {
        if (corridor == null || chain == null || chain.internalNodeIds().isEmpty()) {
            return List.of();
        }
        List<GridPoint2x> chainPath = chainPath2x(corridor, chain);
        ArrayList<ChainNodeDescriptor> result = new ArrayList<>();
        for (Long nodeId : chain.internalNodeIds()) {
            CorridorNode node = corridor.findNode(nodeId);
            if (node == null) {
                throw new IllegalArgumentException("Corridor chain repair references a missing free node");
            }
            int distance2 = distanceAlongPath(chainPath, node.point2x());
            if (distance2 == Integer.MAX_VALUE) {
                throw new IllegalArgumentException("Corridor chain repair could not locate a free node on its original chain path");
            }
            result.add(new ChainNodeDescriptor(
                    node.nodeId(),
                    node.point2x().kind(),
                    isCornerPoint(chainPath, node.point2x()),
                    distance2));
        }
        result.sort(Comparator
                .comparingInt(ChainNodeDescriptor::distance2FromStart)
                .thenComparing(descriptor -> descriptor.nodeId() == null ? Long.MAX_VALUE : descriptor.nodeId()));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<GridPoint2x> chainPath2x(Corridor corridor, ChainDefinition chain) {
        if (corridor == null || chain == null || chain.segmentIds().isEmpty()) {
            return List.of();
        }
        ArrayList<GridPoint2x> result = new ArrayList<>();
        Long currentStartNodeId = chain.startAnchorId();
        for (Long segmentId : chain.segmentIds()) {
            CorridorRoute route = routeForSegment(corridor, segmentId);
            if (route == null) {
                throw new IllegalArgumentException("Corridor chain repair references a missing route segment");
            }
            List<GridPoint2x> path2x = orientedPath2x(route, currentStartNodeId);
            appendUnique(result, path2x);
            currentStartNodeId = Objects.equals(route.startNodeId(), currentStartNodeId)
                    ? route.endNodeId()
                    : route.startNodeId();
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<GridPoint2x> orientedPath2x(CorridorRoute route, Long startNodeId) {
        if (route == null) {
            return List.of();
        }
        if (Objects.equals(route.startNodeId(), startNodeId)) {
            return route.path2x();
        }
        ArrayList<GridPoint2x> reversed = new ArrayList<>(route.path2x());
        Collections.reverse(reversed);
        return reversed.isEmpty() ? List.of() : List.copyOf(reversed);
    }

    private static CorridorRoute routeForSegment(Corridor corridor, Long segmentId) {
        if (corridor == null || segmentId == null) {
            return null;
        }
        return corridor.routes().stream()
                .filter(route -> Objects.equals(route.segmentId(), segmentId))
                .findFirst()
                .orElse(null);
    }

    private static List<PathSlot> chainPathSlots(List<GridPoint2x> path2x) {
        if (path2x == null || path2x.size() < 3) {
            return List.of();
        }
        ArrayList<PathSlot> result = new ArrayList<>();
        LinkedHashSet<Long> seenPointKeys = new LinkedHashSet<>();
        int distance2 = 0;
        for (int index = 1; index < path2x.size(); index++) {
            distance2 += edgeCost(path2x.get(index - 1), path2x.get(index));
            if (index == path2x.size() - 1) {
                continue;
            }
            GridPoint2x point2x = path2x.get(index);
            if (!seenPointKeys.add(point2x.encodedKey())) {
                continue;
            }
            result.add(new PathSlot(
                    point2x,
                    point2x.kind(),
                    isCornerIndex(path2x, index),
                    distance2));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static ChainPlacement placeChainNodes(
            List<ChainNodeDescriptor> originalDescriptors,
            List<PathSlot> slots,
            Set<Long> usedPointKeys,
            long nextSyntheticNodeId
    ) {
        ArrayList<PlacedChainNode> result = new ArrayList<>();
        LinkedHashSet<Long> reservedInChain = new LinkedHashSet<>();
        int minimumDistance2 = 0;
        for (ChainNodeDescriptor descriptor : originalDescriptors == null ? List.<ChainNodeDescriptor>of() : originalDescriptors) {
            PathSlot slot = bestChainSlot(descriptor, slots, usedPointKeys, reservedInChain, minimumDistance2);
            if (slot == null) {
                continue;
            }
            long pointKey = slot.point2x().encodedKey();
            reservedInChain.add(pointKey);
            usedPointKeys.add(pointKey);
            result.add(new PlacedChainNode(descriptor.nodeId(), slot.point2x(), slot.distance2FromStart()));
            minimumDistance2 = slot.distance2FromStart();
        }

        if (originalDescriptors != null && !originalDescriptors.isEmpty()) {
            for (PathSlot slot : slots == null ? List.<PathSlot>of() : slots) {
                long pointKey = slot.point2x().encodedKey();
                if (!slot.corner() || usedPointKeys.contains(pointKey) || reservedInChain.contains(pointKey)) {
                    continue;
                }
                usedPointKeys.add(pointKey);
                result.add(new PlacedChainNode(nextSyntheticNodeId--, slot.point2x(), slot.distance2FromStart()));
            }
        }

        result.sort(Comparator
                .comparingInt(PlacedChainNode::distance2FromStart)
                .thenComparing(PlacedChainNode::point2x, GridPoint2x.ORDER)
                .thenComparing(node -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId()));
        return new ChainPlacement(result.isEmpty() ? List.of() : List.copyOf(result), nextSyntheticNodeId);
    }

    private static PathSlot bestChainSlot(
            ChainNodeDescriptor descriptor,
            List<PathSlot> slots,
            Set<Long> usedPointKeys,
            Set<Long> reservedInChain,
            int minimumDistance2
    ) {
        if (descriptor == null || slots == null || slots.isEmpty()) {
            return null;
        }
        PathSlot best = null;
        for (PathSlot slot : slots) {
            long pointKey = slot.point2x().encodedKey();
            if (slot.distance2FromStart() < minimumDistance2
                    || slot.kind() != descriptor.kind()
                    || usedPointKeys.contains(pointKey)
                    || reservedInChain.contains(pointKey)) {
                continue;
            }
            if (best == null || compareChainSlots(descriptor, slot, best) < 0) {
                best = slot;
            }
        }
        return best;
    }

    private static int compareChainSlots(ChainNodeDescriptor descriptor, PathSlot left, PathSlot right) {
        int leftCornerMismatch = descriptor.corner() == left.corner() ? 0 : 1;
        int rightCornerMismatch = descriptor.corner() == right.corner() ? 0 : 1;
        if (leftCornerMismatch != rightCornerMismatch) {
            return Integer.compare(leftCornerMismatch, rightCornerMismatch);
        }
        int leftDistanceDelta = Math.abs(left.distance2FromStart() - descriptor.distance2FromStart());
        int rightDistanceDelta = Math.abs(right.distance2FromStart() - descriptor.distance2FromStart());
        if (leftDistanceDelta != rightDistanceDelta) {
            return Integer.compare(leftDistanceDelta, rightDistanceDelta);
        }
        int distanceCompare = Integer.compare(left.distance2FromStart(), right.distance2FromStart());
        if (distanceCompare != 0) {
            return distanceCompare;
        }
        return GridPoint2x.ORDER.compare(left.point2x(), right.point2x());
    }

    private static SegmentAllocation allocateChainSegmentIds(List<Long> originalSegmentIds, int requiredCount, long nextSyntheticSegmentId) {
        ArrayList<Long> result = new ArrayList<>(requiredCount);
        List<Long> resolvedOriginalIds = originalSegmentIds == null ? List.of() : originalSegmentIds;
        for (int index = 0; index < requiredCount; index++) {
            if (index < resolvedOriginalIds.size()) {
                result.add(resolvedOriginalIds.get(index));
            } else {
                result.add(nextSyntheticSegmentId--);
            }
        }
        return new SegmentAllocation(result.isEmpty() ? List.of() : List.copyOf(result), nextSyntheticSegmentId);
    }

    private static Map<GridPoint2x, Set<GridPoint2x>> routeAdjacency(Collection<CorridorRoute> routes) {
        LinkedHashMap<GridPoint2x, LinkedHashSet<GridPoint2x>> adjacency = new LinkedHashMap<>();
        for (CorridorRoute route : routes == null ? List.<CorridorRoute>of() : routes) {
            if (route == null) {
                continue;
            }
            for (int index = 1; index < route.path2x().size(); index++) {
                GridPoint2x previous = route.path2x().get(index - 1);
                GridPoint2x current = route.path2x().get(index);
                if (previous == null || current == null || previous.equals(current)) {
                    continue;
                }
                adjacency.computeIfAbsent(previous, ignored -> new LinkedHashSet<>()).add(current);
                adjacency.computeIfAbsent(current, ignored -> new LinkedHashSet<>()).add(previous);
            }
        }
        if (adjacency.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<GridPoint2x, Set<GridPoint2x>> result = new LinkedHashMap<>();
        for (Map.Entry<GridPoint2x, LinkedHashSet<GridPoint2x>> entry : adjacency.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Set<GridPoint2x> roomBoundPoints(List<CorridorNode> nodes) {
        LinkedHashSet<GridPoint2x> result = new LinkedHashSet<>();
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
            if (node != null && node.isRoomBound()) {
                result.add(node.point2x());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<RouteEndpoint> roomEndpoints(List<CorridorNode> nodes) {
        ArrayList<RouteEndpoint> result = new ArrayList<>();
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
            if (node == null || !node.isRoomBound()) {
                continue;
            }
            result.add(new RouteEndpoint(node.roomId(), node.nodeId(), node.point2x()));
        }
        result.sort(Comparator
                .comparing((RouteEndpoint endpoint) -> endpoint.roomId() == null ? Long.MAX_VALUE : endpoint.roomId())
                .thenComparing(endpoint -> endpoint.nodeId() == null ? Long.MAX_VALUE : endpoint.nodeId())
                .thenComparing(RouteEndpoint::point2x, GridPoint2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Integer> roomDistanceVector(
            Map<GridPoint2x, Set<GridPoint2x>> adjacency,
            List<RouteEndpoint> endpoints,
            GridPoint2x point2x
    ) {
        if (endpoints == null || endpoints.isEmpty()) {
            return List.of();
        }
        Map<GridPoint2x, Integer> distances = shortestPointDistances(adjacency, point2x);
        ArrayList<Integer> result = new ArrayList<>(endpoints.size());
        for (RouteEndpoint endpoint : endpoints) {
            result.add(distances.getOrDefault(endpoint.point2x(), Integer.MAX_VALUE));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<GridPoint2x, Integer> shortestPointDistances(
            Map<GridPoint2x, Set<GridPoint2x>> adjacency,
            GridPoint2x start
    ) {
        if (adjacency == null || adjacency.isEmpty() || start == null || !adjacency.containsKey(start)) {
            return Map.of();
        }
        PriorityQueue<PointDistance> frontier = new PriorityQueue<>(Comparator.comparingInt(PointDistance::distance2));
        HashMap<GridPoint2x, Integer> bestDistances = new HashMap<>();
        frontier.add(new PointDistance(start, 0));
        bestDistances.put(start, 0);
        while (!frontier.isEmpty()) {
            PointDistance current = frontier.poll();
            if (current.distance2() > bestDistances.getOrDefault(current.point2x(), Integer.MAX_VALUE)) {
                continue;
            }
            for (GridPoint2x neighbor : adjacency.getOrDefault(current.point2x(), Set.of())) {
                int nextDistance2 = current.distance2() + edgeCost(current.point2x(), neighbor);
                if (nextDistance2 >= bestDistances.getOrDefault(neighbor, Integer.MAX_VALUE)) {
                    continue;
                }
                bestDistances.put(neighbor, nextDistance2);
                frontier.add(new PointDistance(neighbor, nextDistance2));
            }
        }
        return bestDistances.isEmpty() ? Map.of() : Map.copyOf(bestDistances);
    }

    private static ArmSignature armSignature(
            Map<GridPoint2x, Set<GridPoint2x>> adjacency,
            Set<GridPoint2x> roomBoundPoints,
            GridPoint2x point2x
    ) {
        if (adjacency == null || adjacency.isEmpty() || point2x == null || !adjacency.containsKey(point2x)) {
            return new ArmSignature(List.of());
        }
        ArrayList<ArmSignatureEntry> entries = new ArrayList<>();
        for (GridPoint2x neighbor : adjacency.getOrDefault(point2x, Set.of()).stream().sorted(GridPoint2x.ORDER).toList()) {
            CardinalDirection direction = travelDirection(point2x, neighbor);
            if (direction == null) {
                continue;
            }
            int length2 = edgeCost(point2x, neighbor);
            GridPoint2x previous = point2x;
            GridPoint2x current = neighbor;
            while (true) {
                ArrayList<GridPoint2x> forwardNeighbors = new ArrayList<>();
                for (GridPoint2x candidate : adjacency.getOrDefault(current, Set.of())) {
                    if (!candidate.equals(previous)) {
                        forwardNeighbors.add(candidate);
                    }
                }
                forwardNeighbors.sort(GridPoint2x.ORDER);
                if (roomBoundPoints.contains(current) || routeDegree(adjacency, current) != 2 || forwardNeighbors.size() != 1) {
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

    private static int routeDegree(Map<GridPoint2x, Set<GridPoint2x>> adjacency, GridPoint2x point2x) {
        return adjacency == null || point2x == null ? 0 : adjacency.getOrDefault(point2x, Set.of()).size();
    }

    private static List<GridPoint2x> candidatePoints(SearchBounds bounds, GridPoint2x.Kind kind) {
        if (bounds == null || kind == null) {
            return List.of();
        }
        ArrayList<GridPoint2x> result = new ArrayList<>();
        for (int y2 = bounds.minY2(); y2 <= bounds.maxY2(); y2++) {
            for (int x2 = bounds.minX2(); x2 <= bounds.maxX2(); x2++) {
                GridPoint2x point2x = GridPoint2x.raw(x2, y2);
                if (point2x.kind() == kind) {
                    result.add(point2x);
                }
            }
        }
        result.sort(GridPoint2x.ORDER);
        return result.isEmpty() ? List.of() : List.copyOf(result);
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

    private static int incidentRouteCost2(Corridor corridor, Long nodeId) {
        if (corridor == null || nodeId == null) {
            return Integer.MAX_VALUE;
        }
        int total = 0;
        for (CorridorRoute route : corridor.routes()) {
            if (!Objects.equals(route.startNodeId(), nodeId) && !Objects.equals(route.endNodeId(), nodeId)) {
                continue;
            }
            total += routeLength2(route.path2x());
        }
        return total;
    }

    private static int routeLength2(List<GridPoint2x> path2x) {
        if (path2x == null || path2x.size() < 2) {
            return 0;
        }
        int length2 = 0;
        for (int index = 1; index < path2x.size(); index++) {
            length2 += edgeCost(path2x.get(index - 1), path2x.get(index));
        }
        return length2;
    }

    private static int distanceAlongPath(List<GridPoint2x> path2x, GridPoint2x point2x) {
        if (path2x == null || path2x.isEmpty() || point2x == null) {
            return Integer.MAX_VALUE;
        }
        if (path2x.getFirst().equals(point2x)) {
            return 0;
        }
        int distance2 = 0;
        for (int index = 1; index < path2x.size(); index++) {
            distance2 += edgeCost(path2x.get(index - 1), path2x.get(index));
            if (path2x.get(index).equals(point2x)) {
                return distance2;
            }
        }
        return Integer.MAX_VALUE;
    }

    private static boolean isCornerPoint(List<GridPoint2x> path2x, GridPoint2x point2x) {
        if (path2x == null || path2x.size() < 3 || point2x == null) {
            return false;
        }
        for (int index = 1; index < path2x.size() - 1; index++) {
            if (path2x.get(index).equals(point2x) && isCornerIndex(path2x, index)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isCornerIndex(List<GridPoint2x> path2x, int index) {
        if (path2x == null || index <= 0 || index >= path2x.size() - 1) {
            return false;
        }
        GridPoint2x previous = path2x.get(index - 1);
        GridPoint2x current = path2x.get(index);
        GridPoint2x next = path2x.get(index + 1);
        int incomingDx2 = current.x2() - previous.x2();
        int incomingDy2 = current.y2() - previous.y2();
        int outgoingDx2 = next.x2() - current.x2();
        int outgoingDy2 = next.y2() - current.y2();
        return incomingDx2 != outgoingDx2 || incomingDy2 != outgoingDy2;
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

    private static List<Integer> distanceErrorVector(List<Integer> expected, List<Integer> actual) {
        int size = Math.max(expected == null ? 0 : expected.size(), actual == null ? 0 : actual.size());
        ArrayList<Integer> result = new ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            int expectedValue = expected != null && index < expected.size() ? expected.get(index) : Integer.MAX_VALUE;
            int actualValue = actual != null && index < actual.size() ? actual.get(index) : Integer.MAX_VALUE;
            if (expectedValue == Integer.MAX_VALUE || actualValue == Integer.MAX_VALUE) {
                result.add(Integer.MAX_VALUE);
            } else {
                result.add(Math.abs(expectedValue - actualValue));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static int compareStructuralCandidates(StructuralCandidate left, StructuralCandidate right) {
        int errorCompare = compareDistanceVectors(left.distanceErrorVector(), right.distanceErrorVector());
        if (errorCompare != 0) {
            return errorCompare;
        }
        int routeCostCompare = Integer.compare(left.routeCost2(), right.routeCost2());
        if (routeCostCompare != 0) {
            return routeCostCompare;
        }
        int originalDistanceCompare = Integer.compare(left.originalDistance2(), right.originalDistance2());
        if (originalDistanceCompare != 0) {
            return originalDistanceCompare;
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
                result.add(new CorridorComponent(componentNodes, componentSegments));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
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

    private static GridSegment2x roomBoundaryEdge(CorridorNode node) {
        if (node == null || node.roomCell() == null || node.roomBoundaryDirection() == null) {
            return null;
        }
        return GridSegment2x.boundaryEdge(node.roomCell(), node.roomBoundaryDirection());
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

    public record CorridorTopologyUpdate(boolean changed, List<CorridorComponent> components) {
        public CorridorTopologyUpdate {
            components = components == null ? List.of() : List.copyOf(components);
        }

        public static CorridorTopologyUpdate unchanged() {
            return new CorridorTopologyUpdate(false, List.of());
        }
    }

    public record CorridorComponent(List<CorridorNode> nodes, List<CorridorSegment> segments) {
        public CorridorComponent {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
            segments = segments == null ? List.of() : List.copyOf(segments);
        }
    }

    private record RoomRewriteBinding(
            Long roomId,
            CellCoord roomCell,
            CardinalDirection direction,
            GridPoint2x anchorPoint
    ) {
    }

    private record SearchBounds(int minX2, int maxX2, int minY2, int maxY2) {
    }

    private record RouteEndpoint(Long roomId, Long nodeId, GridPoint2x point2x) {
        private RouteEndpoint {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }
    }

    private record ArmSignature(List<ArmSignatureEntry> entries) {
        private ArmSignature {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }
    }

    private record ArmSignatureEntry(CardinalDirection direction, int length2) {
        private ArmSignatureEntry {
            direction = Objects.requireNonNull(direction, "direction");
        }
    }

    private record FreeNodeDescriptor(
            Long nodeId,
            GridPoint2x point2x,
            GridPoint2x.Kind kind,
            int degree,
            List<Long> neighborNodeIds,
            List<Integer> roomDistanceVector,
            ArmSignature armSignature
    ) {
        private FreeNodeDescriptor {
            point2x = Objects.requireNonNull(point2x, "point2x");
            kind = Objects.requireNonNull(kind, "kind");
            neighborNodeIds = neighborNodeIds == null ? List.of() : List.copyOf(neighborNodeIds);
            roomDistanceVector = roomDistanceVector == null ? List.of() : List.copyOf(roomDistanceVector);
            armSignature = Objects.requireNonNull(armSignature, "armSignature");
        }
    }

    private record RoutedNodeDescriptor(
            int degree,
            List<Integer> roomDistanceVector,
            ArmSignature armSignature
    ) {
        private RoutedNodeDescriptor {
            roomDistanceVector = roomDistanceVector == null ? List.of() : List.copyOf(roomDistanceVector);
            armSignature = Objects.requireNonNull(armSignature, "armSignature");
        }
    }

    private record StructuralCandidate(
            GridPoint2x point2x,
            List<Integer> distanceErrorVector,
            int routeCost2,
            int originalDistance2
    ) {
        private StructuralCandidate {
            point2x = Objects.requireNonNull(point2x, "point2x");
            distanceErrorVector = distanceErrorVector == null ? List.of() : List.copyOf(distanceErrorVector);
        }
    }

    private record ChainDefinition(
            Long startAnchorId,
            Long endAnchorId,
            List<Long> segmentIds,
            List<Long> internalNodeIds
    ) {
        private ChainDefinition {
            segmentIds = segmentIds == null ? List.of() : List.copyOf(segmentIds);
            internalNodeIds = internalNodeIds == null ? List.of() : List.copyOf(internalNodeIds);
        }
    }

    private record ChainNodeDescriptor(
            Long nodeId,
            GridPoint2x.Kind kind,
            boolean corner,
            int distance2FromStart
    ) {
        private ChainNodeDescriptor {
            kind = Objects.requireNonNull(kind, "kind");
        }
    }

    private record PathSlot(
            GridPoint2x point2x,
            GridPoint2x.Kind kind,
            boolean corner,
            int distance2FromStart
    ) {
        private PathSlot {
            point2x = Objects.requireNonNull(point2x, "point2x");
            kind = Objects.requireNonNull(kind, "kind");
        }
    }

    private record PlacedChainNode(Long nodeId, GridPoint2x point2x, int distance2FromStart) {
        private PlacedChainNode {
            point2x = Objects.requireNonNull(point2x, "point2x");
        }
    }

    private record ChainPlacement(List<PlacedChainNode> nodes, long nextSyntheticNodeId) {
        private ChainPlacement {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
        }
    }

    private record SegmentAllocation(List<Long> segmentIds, long nextSyntheticSegmentId) {
        private SegmentAllocation {
            segmentIds = segmentIds == null ? List.of() : List.copyOf(segmentIds);
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
