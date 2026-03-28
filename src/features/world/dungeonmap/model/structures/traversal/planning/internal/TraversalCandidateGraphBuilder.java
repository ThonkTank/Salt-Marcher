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
        LinkedHashMap<NodePair, TraversalEdge> edgesByPair = new LinkedHashMap<>();
        addHorizontalCandidates(edgesByPair, resolvedTopology);
        List<TraversalEdge> waypointSpineEdges = addWaypointSpineCandidates(edgesByPair, resolvedTopology);
        addVerticalCandidates(edgesByPair, resolvedTopology);
        return new CandidateGraph(List.copyOf(edgesByPair.values()), waypointSpineEdges);
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
            Map<NodePair, TraversalEdge> edgesByPair,
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
                addHorizontalNeighbors(edgesByPair, topology, node, levelNodes);
            }
        }
    }

    private static void addHorizontalNeighbors(
            Map<NodePair, TraversalEdge> edgesByPair,
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
            if (addCandidateEdge(edgesByPair, edgeBetween(topology, node, candidate))) {
                added++;
            }
        }
    }

    private static List<TraversalEdge> addWaypointSpineCandidates(
            Map<NodePair, TraversalEdge> edgesByPair,
            TraversalTopology topology
    ) {
        ArrayList<TraversalEdge> result = new ArrayList<>();
        List<TraversalNode> waypointNodes = topology == null ? List.of() : topology.requiredWaypointNodes();
        for (int index = 1; index < waypointNodes.size(); index++) {
            TraversalNode start = waypointNodes.get(index - 1);
            TraversalNode end = waypointNodes.get(index);
            addCandidateEdge(edgesByPair, edgeBetween(topology, start, end));
            TraversalEdge selectedEdge = edgesByPair.get(NodePair.of(start.nodeId(), end.nodeId()));
            if (selectedEdge != null) {
                result.add(selectedEdge);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void addVerticalCandidates(
            Map<NodePair, TraversalEdge> edgesByPair,
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
                addCandidateEdge(edgesByPair, edgeBetween(topology, first, second));
            }
        }
    }

    private static boolean addCandidateEdge(
            Map<NodePair, TraversalEdge> edgesByPair,
            TraversalEdge edge
    ) {
        if (edgesByPair == null || edge == null || edge.costHint() == Long.MAX_VALUE) {
            return false;
        }
        NodePair pair = NodePair.of(edge.startNodeId(), edge.endNodeId());
        if (pair == null) {
            return false;
        }
        TraversalEdge existing = edgesByPair.get(pair);
        if (existing == null || edge.costHint() < existing.costHint()) {
            edgesByPair.put(pair, edge);
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
        private final Map<NodePair, TraversalEdge> edgesByPair;
        private final List<TraversalEdge> waypointSpineEdges;

        CandidateGraph(
                List<TraversalEdge> edges,
                List<TraversalEdge> waypointSpineEdges
        ) {
            this.edges = normalizeEdges(edges);
            this.edgesByNodeId = indexEdgesByNodeId(this.edges);
            this.edgesByPair = indexEdgesByPair(this.edges);
            this.waypointSpineEdges = normalizeEdges(waypointSpineEdges);
        }

        List<TraversalEdge> edges() {
            return edges;
        }

        List<TraversalEdge> waypointSpineEdges() {
            return waypointSpineEdges;
        }

        List<TraversalEdge> edgesFrom(TraversalNodeId nodeId) {
            if (nodeId == null) {
                return List.of();
            }
            return edgesByNodeId.getOrDefault(nodeId, List.of());
        }

        TraversalEdge edgeBetween(TraversalNodeId firstNodeId, TraversalNodeId secondNodeId) {
            NodePair pair = NodePair.of(firstNodeId, secondNodeId);
            return pair == null ? null : edgesByPair.get(pair);
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

        private static Map<NodePair, TraversalEdge> indexEdgesByPair(List<TraversalEdge> edges) {
            if (edges == null || edges.isEmpty()) {
                return Map.of();
            }
            LinkedHashMap<NodePair, TraversalEdge> result = new LinkedHashMap<>();
            for (TraversalEdge edge : edges) {
                if (edge == null) {
                    continue;
                }
                NodePair pair = NodePair.of(edge.startNodeId(), edge.endNodeId());
                if (pair != null) {
                    result.putIfAbsent(pair, edge);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }
    }

    private record NodePair(
            TraversalNodeId firstNodeId,
            TraversalNodeId secondNodeId
    ) {
        private static NodePair of(
                TraversalNodeId firstNodeId,
                TraversalNodeId secondNodeId
        ) {
            if (firstNodeId == null
                    || secondNodeId == null
                    || firstNodeId.equals(secondNodeId)) {
                return null;
            }
            return firstNodeId.value().compareTo(secondNodeId.value()) <= 0
                    ? new NodePair(firstNodeId, secondNodeId)
                    : new NodePair(secondNodeId, firstNodeId);
        }
    }
}
