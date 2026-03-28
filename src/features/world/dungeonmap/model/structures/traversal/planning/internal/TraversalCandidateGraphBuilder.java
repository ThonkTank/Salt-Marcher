package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class TraversalCandidateGraphBuilder {

    private static final int MAX_HORIZONTAL_NEIGHBORS = 3;

    private TraversalCandidateGraphBuilder() {
        throw new AssertionError("No instances");
    }

    static CandidateGraph build(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        LinkedHashMap<TraversalEdgeId, TraversalEdge> edgesById = new LinkedHashMap<>();
        addHorizontalCandidates(edgesById, resolvedTopology);
        List<TraversalEdgeId> waypointSpineEdgeIds = addWaypointSpineCandidates(edgesById, resolvedTopology);
        addRequiredPortalAttachmentCandidates(edgesById, resolvedTopology);
        addVerticalCandidates(edgesById, resolvedTopology);
        return new CandidateGraph(List.copyOf(edgesById.values()), waypointSpineEdgeIds);
    }

    static TraversalEdge edgeBetween(
            TraversalTopology topology,
            TraversalNode start,
            TraversalNode end
    ) {
        if (start == null
                || end == null
                || start.nodeId() == null
                || end.nodeId() == null
                || start.nodeId().equals(end.nodeId())) {
            return null;
        }
        if (start.levelZ() == end.levelZ()) {
            return horizontalEdge(topology, start, end);
        }
        VerticalCandidateEdge candidateEdge = VerticalCandidateGenerator.project(
                start,
                end,
                topology == null ? Set.of() : topology.obstacles());
        return candidateEdge.hasCandidates() ? candidateEdge : null;
    }

    private static void addHorizontalCandidates(
            Map<TraversalEdgeId, TraversalEdge> edgesById,
            TraversalTopology topology
    ) {
        Map<Integer, List<TraversalNode>> nodesByLevel = new LinkedHashMap<>();
        for (TraversalNode node : topology == null ? List.<TraversalNode>of() : topology.nodes()) {
            if (node != null) {
                nodesByLevel.computeIfAbsent(node.levelZ(), ignored -> new ArrayList<>()).add(node);
            }
        }
        for (List<TraversalNode> levelNodes : nodesByLevel.values()) {
            for (TraversalNode node : levelNodes) {
                addHorizontalNeighbors(edgesById, topology, node, levelNodes);
            }
        }
    }

    private static void addHorizontalNeighbors(
            Map<TraversalEdgeId, TraversalEdge> edgesById,
            TraversalTopology topology,
            TraversalNode node,
            List<TraversalNode> levelNodes
    ) {
        if (node == null || levelNodes == null || levelNodes.size() < 2) {
            return;
        }
        ArrayList<TraversalNode> candidates = new ArrayList<>();
        for (TraversalNode candidate : levelNodes) {
            if (candidate != null && !Objects.equals(node.nodeId(), candidate.nodeId())) {
                candidates.add(candidate);
            }
        }
        candidates.sort(Comparator
                .comparingLong((TraversalNode candidate) -> horizontalDistance(node, candidate))
                .thenComparing(candidate -> candidate.nodeId().value()));
        int added = 0;
        for (TraversalNode candidate : candidates) {
            if (added >= MAX_HORIZONTAL_NEIGHBORS) {
                return;
            }
            if (addCandidateEdge(edgesById, edgeBetween(topology, node, candidate))) {
                added++;
            }
        }
    }

    private static List<TraversalEdgeId> addWaypointSpineCandidates(
            Map<TraversalEdgeId, TraversalEdge> edgesById,
            TraversalTopology topology
    ) {
        ArrayList<TraversalEdgeId> result = new ArrayList<>();
        List<TraversalNode> waypointNodes = topology == null ? List.of() : topology.requiredWaypointNodes();
        for (int index = 1; index < waypointNodes.size(); index++) {
            TraversalNode start = waypointNodes.get(index - 1);
            TraversalNode end = waypointNodes.get(index);
            TraversalEdge candidateEdge = edgeBetween(topology, start, end);
            addCandidateEdge(edgesById, candidateEdge);
            if (candidateEdge != null && candidateEdge.edgeId() != null && edgesById.containsKey(candidateEdge.edgeId())) {
                result.add(candidateEdge.edgeId());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void addRequiredPortalAttachmentCandidates(
            Map<TraversalEdgeId, TraversalEdge> edgesById,
            TraversalTopology topology
    ) {
        if (topology == null || !topology.hasWaypoints()) {
            return;
        }
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            for (TraversalNode waypointNode : topology.requiredWaypointNodes()) {
                addCandidateEdge(edgesById, edgeBetween(topology, roomPortalNode, waypointNode));
            }
        }
    }

    private static void addVerticalCandidates(
            Map<TraversalEdgeId, TraversalEdge> edgesById,
            TraversalTopology topology
    ) {
        List<TraversalNode> nodes = topology == null ? List.of() : topology.nodes();
        for (int firstIndex = 0; firstIndex < nodes.size(); firstIndex++) {
            TraversalNode first = nodes.get(firstIndex);
            if (first == null) {
                continue;
            }
            for (int secondIndex = firstIndex + 1; secondIndex < nodes.size(); secondIndex++) {
                TraversalNode second = nodes.get(secondIndex);
                if (second == null || first.levelZ() == second.levelZ()) {
                    continue;
                }
                addCandidateEdge(edgesById, edgeBetween(topology, first, second));
            }
        }
    }

    private static boolean addCandidateEdge(
            Map<TraversalEdgeId, TraversalEdge> edgesById,
            TraversalEdge edge
    ) {
        if (edgesById == null || edge == null || edge.costHint() == Long.MAX_VALUE) {
            return false;
        }
        TraversalEdgeId edgeId = edge.edgeId();
        if (edgeId == null) {
            return false;
        }
        TraversalEdge existing = edgesById.get(edgeId);
        if (existing == null || edge.costHint() < existing.costHint()) {
            edgesById.put(edgeId, edge);
            return true;
        }
        return false;
    }

    private static HorizontalTraversalEdge horizontalEdge(
            TraversalTopology topology,
            TraversalNode start,
            TraversalNode end
    ) {
        LocalSegmentResult segmentResult = LocalTraversalRoutePlanner.route(new LocalSegmentRequest(
                terminalFor(start),
                terminalFor(end),
                topology == null ? Set.of() : topology.obstacles(),
                List.of()));
        if (!segmentResult.routable()) {
            return null;
        }
        return new HorizontalTraversalEdge(
                start.nodeId(),
                end.nodeId(),
                segmentResult.pathCells().size());
    }

    private static LocalSegmentRequest.LocalTerminal terminalFor(TraversalNode node) {
        if (node == null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of());
        }
        if (node.kind() == TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
            return new LocalSegmentRequest.RoomPortalTerminal(node);
        }
        return LocalSegmentRequest.FixedCellsTerminal.of(node.anchorCells());
    }

    private static long horizontalDistance(TraversalNode first, TraversalNode second) {
        if (first == null || second == null || first.anchor() == null || second.anchor() == null) {
            return Long.MAX_VALUE;
        }
        return Math.abs((long) first.anchor().x() - second.anchor().x())
                + Math.abs((long) first.anchor().y() - second.anchor().y());
    }

    static final class CandidateGraph {

        private final List<TraversalEdge> edges;
        private final Map<TraversalNodeId, List<TraversalEdge>> edgesByNodeId;
        private final Map<TraversalEdgeId, TraversalEdge> edgesById;
        private final List<TraversalEdgeId> waypointSpineEdgeIds;

        CandidateGraph(
                List<TraversalEdge> edges,
                List<TraversalEdgeId> waypointSpineEdgeIds
        ) {
            this.edges = normalizeEdges(edges);
            this.edgesByNodeId = indexEdgesByNodeId(this.edges);
            this.edgesById = indexEdgesById(this.edges);
            this.waypointSpineEdgeIds = normalizeEdgeIds(waypointSpineEdgeIds);
        }

        static CandidateGraph empty() {
            return new CandidateGraph(List.of(), List.of());
        }

        List<TraversalEdge> edges() {
            return edges;
        }

        List<TraversalEdgeId> waypointSpineEdgeIds() {
            return waypointSpineEdgeIds;
        }

        List<TraversalEdge> edgesFrom(TraversalNodeId nodeId) {
            if (nodeId == null) {
                return List.of();
            }
            return edgesByNodeId.getOrDefault(nodeId, List.of());
        }

        TraversalEdge edgeBetween(TraversalNodeId firstNodeId, TraversalNodeId secondNodeId) {
            return edge(TraversalEdgeId.of(firstNodeId, secondNodeId));
        }

        TraversalEdge edge(TraversalEdgeId edgeId) {
            return edgeId == null ? null : edgesById.get(edgeId);
        }

        private static List<TraversalEdge> normalizeEdges(List<TraversalEdge> edges) {
            if (edges == null || edges.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<TraversalEdge> result = new LinkedHashSet<>();
            for (TraversalEdge edge : edges) {
                if (edge != null) {
                    result.add(edge);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static List<TraversalEdgeId> normalizeEdgeIds(List<TraversalEdgeId> edgeIds) {
            if (edgeIds == null || edgeIds.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<TraversalEdgeId> result = new LinkedHashSet<>();
            for (TraversalEdgeId edgeId : edgeIds) {
                if (edgeId != null) {
                    result.add(edgeId);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static Map<TraversalNodeId, List<TraversalEdge>> indexEdgesByNodeId(List<TraversalEdge> edges) {
            if (edges == null || edges.isEmpty()) {
                return Map.of();
            }
            LinkedHashMap<TraversalNodeId, ArrayList<TraversalEdge>> result = new LinkedHashMap<>();
            for (TraversalEdge edge : edges) {
                if (edge == null) {
                    continue;
                }
                result.computeIfAbsent(edge.startNodeId(), ignored -> new ArrayList<>()).add(edge);
                result.computeIfAbsent(edge.endNodeId(), ignored -> new ArrayList<>()).add(edge);
            }
            if (result.isEmpty()) {
                return Map.of();
            }
            LinkedHashMap<TraversalNodeId, List<TraversalEdge>> copy = new LinkedHashMap<>();
            for (Map.Entry<TraversalNodeId, ArrayList<TraversalEdge>> entry : result.entrySet()) {
                copy.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
            return Map.copyOf(copy);
        }

        private static Map<TraversalEdgeId, TraversalEdge> indexEdgesById(List<TraversalEdge> edges) {
            if (edges == null || edges.isEmpty()) {
                return Map.of();
            }
            LinkedHashMap<TraversalEdgeId, TraversalEdge> result = new LinkedHashMap<>();
            for (TraversalEdge edge : edges) {
                if (edge == null || edge.edgeId() == null) {
                    continue;
                }
                result.putIfAbsent(edge.edgeId(), edge);
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }
    }
}
