package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class TraversalStructurePlanner {

    private static final int MAX_HORIZONTAL_NEIGHBORS = 3;

    private TraversalStructurePlanner() {
        throw new AssertionError("No instances");
    }

    public static StructurePlan plan(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        List<TraversalEdge> candidateEdges = buildCandidateEdges(resolvedTopology);
        return resolvedTopology.hasWaypoints()
                ? planWaypointBackbone(resolvedTopology, candidateEdges)
                : planRequiredNodeNetwork(resolvedTopology, candidateEdges);
    }

    private static StructurePlan planRequiredNodeNetwork(
            TraversalTopology topology,
            List<TraversalEdge> candidateEdges
    ) {
        List<TraversalNode> requiredNodes = topology == null ? List.of() : topology.requiredNodes();
        if (requiredNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        Map<TraversalNodeId, List<TraversalEdge>> candidateEdgesByNodeId = indexEdgesByNodeId(candidateEdges);
        ArrayList<TraversalEdge> selectedEdges = new ArrayList<>();
        LinkedHashSet<TraversalNodeId> connectedNodeIds = new LinkedHashSet<>();
        LinkedHashSet<TraversalNodeId> requiredNodeIds = requiredNodeIds(requiredNodes);
        TraversalNode seedNode = requiredNodes.getFirst();
        connectedNodeIds.add(seedNode.nodeId());
        while (connectedNodeIds.size() < requiredNodeIds.size()) {
            TraversalEdge nextEdge = null;
            TraversalNodeId nextNodeId = null;
            for (TraversalNodeId connectedNodeId : connectedNodeIds) {
                for (TraversalEdge candidateEdge : candidateEdgesByNodeId.getOrDefault(connectedNodeId, List.of())) {
                    TraversalNodeId candidateNodeId = otherNodeId(candidateEdge, connectedNodeId);
                    if (candidateNodeId == null
                            || connectedNodeIds.contains(candidateNodeId)
                            || !requiredNodeIds.contains(candidateNodeId)
                            || !isBetterEdge(candidateEdge, nextEdge, candidateNodeId, nextNodeId)) {
                        continue;
                    }
                    nextEdge = candidateEdge;
                    nextNodeId = candidateNodeId;
                }
            }
            if (nextEdge == null || nextNodeId == null) {
                break;
            }
            selectedEdges.add(nextEdge);
            connectedNodeIds.add(nextNodeId);
        }
        return new StructurePlan(topology, selectedEdges);
    }

    private static StructurePlan planWaypointBackbone(
            TraversalTopology topology,
            List<TraversalEdge> candidateEdges
    ) {
        List<TraversalNode> waypointNodes = topology == null ? List.of() : topology.requiredWaypointNodes();
        if (waypointNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        Map<String, TraversalEdge> candidateEdgesByKey = indexEdgesByKey(candidateEdges);
        ArrayList<TraversalEdge> selectedEdges = new ArrayList<>();
        for (int index = 1; index < waypointNodes.size(); index++) {
            TraversalNode start = waypointNodes.get(index - 1);
            TraversalNode end = waypointNodes.get(index);
            TraversalEdge selectedEdge = candidateEdgesByKey.get(edgeKey(
                    start == null ? null : start.nodeId(),
                    end == null ? null : end.nodeId()));
            if (selectedEdge != null) {
                selectedEdges.add(selectedEdge);
            }
        }
        if (waypointNodes.size() > 1 && selectedEdges.size() != waypointNodes.size() - 1) {
            return new StructurePlan(topology, selectedEdges);
        }
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            TraversalEdge attachmentEdge = selectBestPortalAttachmentEdge(candidateEdgesByKey, roomPortalNode, waypointNodes);
            if (attachmentEdge != null) {
                selectedEdges.add(attachmentEdge);
            }
        }
        return new StructurePlan(topology, selectedEdges);
    }

    private static TraversalEdge selectBestPortalAttachmentEdge(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalNode roomPortalNode,
            List<TraversalNode> spineNodes
    ) {
        if (roomPortalNode == null || spineNodes == null || spineNodes.isEmpty()) {
            return null;
        }
        TraversalNode bestTarget = null;
        TraversalEdge bestEdge = null;
        for (TraversalNode spineNode : spineNodes) {
            TraversalEdge candidateEdge = candidateEdgesByKey.get(edgeKey(
                    roomPortalNode.nodeId(),
                    spineNode == null ? null : spineNode.nodeId()));
            if (candidateEdge == null || !isBetterEdge(candidateEdge, bestEdge, spineNode.nodeId(), bestTarget == null ? null : bestTarget.nodeId())) {
                continue;
            }
            bestTarget = spineNode;
            bestEdge = candidateEdge;
        }
        return bestTarget == null ? null : bestEdge;
    }

    private static LinkedHashSet<TraversalNodeId> requiredNodeIds(List<TraversalNode> requiredNodes) {
        LinkedHashSet<TraversalNodeId> result = new LinkedHashSet<>();
        for (TraversalNode requiredNode : requiredNodes == null ? List.<TraversalNode>of() : requiredNodes) {
            if (requiredNode != null && requiredNode.nodeId() != null) {
                result.add(requiredNode.nodeId());
            }
        }
        return result;
    }

    private static TraversalNodeId otherNodeId(
            TraversalEdge edge,
            TraversalNodeId nodeId
    ) {
        if (edge == null || nodeId == null) {
            return null;
        }
        if (nodeId.equals(edge.startNodeId())) {
            return edge.endNodeId();
        }
        if (nodeId.equals(edge.endNodeId())) {
            return edge.startNodeId();
        }
        return null;
    }

    private static boolean isBetterEdge(
            TraversalEdge candidateEdge,
            TraversalEdge currentBest,
            TraversalNodeId candidateNodeId,
            TraversalNodeId currentBestNodeId
    ) {
        if (candidateEdge == null) {
            return false;
        }
        if (currentBest == null) {
            return true;
        }
        if (candidateEdge.costHint() != currentBest.costHint()) {
            return candidateEdge.costHint() < currentBest.costHint();
        }
        String candidateKey = candidateNodeId == null ? "" : candidateNodeId.value();
        String bestKey = currentBestNodeId == null ? "" : currentBestNodeId.value();
        int nodeComparison = candidateKey.compareTo(bestKey);
        if (nodeComparison != 0) {
            return nodeComparison < 0;
        }
        int startComparison = nodeValue(candidateEdge.startNodeId()).compareTo(nodeValue(currentBest.startNodeId()));
        if (startComparison != 0) {
            return startComparison < 0;
        }
        return nodeValue(candidateEdge.endNodeId()).compareTo(nodeValue(currentBest.endNodeId())) < 0;
    }

    private static List<TraversalEdge> buildCandidateEdges(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        LinkedHashMap<String, TraversalEdge> candidateEdgesByKey = new LinkedHashMap<>();
        addHorizontalCandidates(candidateEdgesByKey, resolvedTopology);
        addWaypointBackboneCandidates(candidateEdgesByKey, resolvedTopology);
        addVerticalCandidates(candidateEdgesByKey, resolvedTopology);
        return candidateEdgesByKey.isEmpty() ? List.of() : List.copyOf(candidateEdgesByKey.values());
    }

    private static void addHorizontalCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
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
                addHorizontalCandidates(candidateEdgesByKey, topology, node, levelNodes);
            }
        }
        addRequiredPortalAttachmentCandidates(candidateEdgesByKey, topology);
    }

    private static void addWaypointBackboneCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology
    ) {
        if (topology == null || !topology.hasWaypoints()) {
            return;
        }
        List<TraversalNode> waypointNodes = topology.requiredWaypointNodes();
        for (int index = 1; index < waypointNodes.size(); index++) {
            addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, waypointNodes.get(index - 1), waypointNodes.get(index)));
        }
    }

    private static void addRequiredPortalAttachmentCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalTopology topology
    ) {
        if (topology == null || !topology.hasWaypoints()) {
            return;
        }
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            for (TraversalNode waypointNode : topology.requiredWaypointNodes()) {
                addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, roomPortalNode, waypointNode));
            }
        }
    }

    private static void addHorizontalCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
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
            if (addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, node, candidate))) {
                added++;
            }
        }
    }

    private static void addVerticalCandidates(
            Map<String, TraversalEdge> candidateEdgesByKey,
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
                addCandidateEdge(candidateEdgesByKey, edgeBetween(topology, first, second));
            }
        }
    }

    private static TraversalEdge edgeBetween(
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
            LocalSegmentResult segmentResult = LocalTraversalRoutePlanner.route(new LocalSegmentRequest(
                    terminalFor(start),
                    terminalFor(end),
                    topology == null ? Set.of() : topology.obstacles()));
            if (!segmentResult.routable()) {
                return null;
            }
            return new HorizontalTraversalEdge(
                    start.nodeId(),
                    end.nodeId(),
                    segmentResult.pathCells().size());
        }
        VerticalCandidateEdge candidateEdge = VerticalCandidateGenerator.project(
                start,
                end,
                topology == null ? Set.of() : topology.obstacles());
        return candidateEdge.hasCandidates() ? candidateEdge : null;
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

    private static boolean addCandidateEdge(
            Map<String, TraversalEdge> candidateEdgesByKey,
            TraversalEdge edge
    ) {
        if (candidateEdgesByKey == null || edge == null || edge.costHint() == Long.MAX_VALUE) {
            return false;
        }
        String edgeKey = edgeKey(edge.startNodeId(), edge.endNodeId());
        if (edgeKey == null) {
            return false;
        }
        TraversalEdge existing = candidateEdgesByKey.get(edgeKey);
        if (existing == null || edge.costHint() < existing.costHint()) {
            candidateEdgesByKey.put(edgeKey, edge);
            return true;
        }
        return false;
    }

    private static Map<TraversalNodeId, List<TraversalEdge>> indexEdgesByNodeId(List<TraversalEdge> candidateEdges) {
        if (candidateEdges == null || candidateEdges.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<TraversalNodeId, ArrayList<TraversalEdge>> result = new LinkedHashMap<>();
        for (TraversalEdge candidateEdge : candidateEdges) {
            if (candidateEdge == null) {
                continue;
            }
            result.computeIfAbsent(candidateEdge.startNodeId(), ignored -> new ArrayList<>()).add(candidateEdge);
            result.computeIfAbsent(candidateEdge.endNodeId(), ignored -> new ArrayList<>()).add(candidateEdge);
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

    private static Map<String, TraversalEdge> indexEdgesByKey(List<TraversalEdge> candidateEdges) {
        if (candidateEdges == null || candidateEdges.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, TraversalEdge> result = new LinkedHashMap<>();
        for (TraversalEdge candidateEdge : candidateEdges) {
            String edgeKey = candidateEdge == null ? null : edgeKey(candidateEdge.startNodeId(), candidateEdge.endNodeId());
            if (edgeKey != null) {
                result.putIfAbsent(edgeKey, candidateEdge);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static String edgeKey(TraversalNodeId firstNodeId, TraversalNodeId secondNodeId) {
        if (firstNodeId == null || secondNodeId == null) {
            return null;
        }
        String firstValue = firstNodeId.value();
        String secondValue = secondNodeId.value();
        return firstValue.compareTo(secondValue) <= 0
                ? firstValue + "->" + secondValue
                : secondValue + "->" + firstValue;
    }

    private static String nodeValue(TraversalNodeId nodeId) {
        return nodeId == null ? "" : nodeId.value();
    }

    public record StructurePlan(
            TraversalTopology topology,
            List<TraversalEdge> selectedEdges
    ) {
        public StructurePlan {
            topology = topology == null ? TraversalTopology.empty() : topology;
            selectedEdges = normalizeSelectedEdges(selectedEdges);
        }

        public static StructurePlan empty() {
            return new StructurePlan(
                    TraversalTopology.empty(),
                    List.of());
        }

        private static List<TraversalEdge> normalizeSelectedEdges(List<TraversalEdge> selectedEdges) {
            if (selectedEdges == null || selectedEdges.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<TraversalEdge> result = new LinkedHashSet<>();
            for (TraversalEdge selectedEdge : selectedEdges) {
                if (selectedEdge == null) {
                    continue;
                }
                result.add(selectedEdge);
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }
}
