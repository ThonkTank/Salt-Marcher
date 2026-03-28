package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class TraversalStructurePlanner {

    private TraversalStructurePlanner() {
        throw new AssertionError("No instances");
    }

    public static StructurePlan plan(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        TraversalCandidateGraphBuilder.CandidateGraph candidateGraph = TraversalCandidateGraphBuilder.build(resolvedTopology);
        return resolvedTopology.hasWaypoints()
                ? planWaypointBackbone(resolvedTopology, candidateGraph)
                : planRequiredNodeNetwork(resolvedTopology, candidateGraph);
    }

    private static StructurePlan planRequiredNodeNetwork(
            TraversalTopology topology,
            TraversalCandidateGraphBuilder.CandidateGraph candidateGraph
    ) {
        List<TraversalNode> requiredNodes = topology == null ? List.of() : topology.requiredNodes();
        if (requiredNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        ArrayList<TraversalNode> guideNodes = new ArrayList<>();
        ArrayList<TraversalEdge> guideEdges = new ArrayList<>();
        LinkedHashSet<TraversalNodeId> connectedNodeIds = new LinkedHashSet<>();
        LinkedHashSet<TraversalNodeId> requiredNodeIds = requiredNodeIds(requiredNodes);
        TraversalNode seedNode = requiredNodes.getFirst();
        connectedNodeIds.add(seedNode.nodeId());
        guideNodes.add(seedNode);
        while (connectedNodeIds.size() < requiredNodeIds.size()) {
            TraversalEdge nextEdge = null;
            TraversalNodeId nextNodeId = null;
            for (TraversalNodeId connectedNodeId : connectedNodeIds) {
                for (TraversalEdge candidateEdge : candidateGraph.edgesFrom(connectedNodeId)) {
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
            guideEdges.add(nextEdge);
            connectedNodeIds.add(nextNodeId);
            TraversalNode guideNode = topology.node(nextNodeId);
            if (guideNode != null) {
                guideNodes.add(guideNode);
            }
        }
        return new StructurePlan(topology, guideNodes, guideEdges, List.of());
    }

    private static StructurePlan planWaypointBackbone(
            TraversalTopology topology,
            TraversalCandidateGraphBuilder.CandidateGraph candidateGraph
    ) {
        List<TraversalNode> waypointNodes = topology == null ? List.of() : topology.requiredWaypointNodes();
        if (waypointNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        List<TraversalEdge> guideEdges = candidateGraph.waypointSpineEdges();
        if (guideEdges.size() != Math.max(waypointNodes.size() - 1, 0)) {
            return new StructurePlan(topology, waypointNodes, guideEdges, List.of());
        }
        ArrayList<PortalAttachment> portalAttachments = new ArrayList<>();
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            PortalAttachment portalAttachment = selectBestPortalAttachment(topology, roomPortalNode, waypointNodes);
            if (portalAttachment != null) {
                portalAttachments.add(portalAttachment);
            }
        }
        return new StructurePlan(topology, waypointNodes, guideEdges, portalAttachments);
    }

    private static PortalAttachment selectBestPortalAttachment(
            TraversalTopology topology,
            TraversalNode roomPortalNode,
            List<TraversalNode> spineNodes
    ) {
        if (roomPortalNode == null || spineNodes == null || spineNodes.isEmpty()) {
            return null;
        }
        TraversalNode bestTarget = null;
        TraversalEdge bestEdge = null;
        for (TraversalNode spineNode : spineNodes) {
            TraversalEdge candidateEdge = TraversalCandidateGraphBuilder.edgeBetween(topology, roomPortalNode, spineNode);
            if (candidateEdge == null || !isBetterEdge(candidateEdge, bestEdge, spineNode.nodeId(), bestTarget == null ? null : bestTarget.nodeId())) {
                continue;
            }
            bestTarget = spineNode;
            bestEdge = candidateEdge;
        }
        return bestTarget == null || bestEdge == null
                ? null
                : new PortalAttachment(roomPortalNode.nodeId(), bestTarget.nodeId(), bestEdge);
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
        return candidateKey.compareTo(bestKey) < 0;
    }

    public record StructurePlan(
            TraversalTopology topology,
            List<TraversalNode> guideNodes,
            List<TraversalEdge> guideEdges,
            List<PortalAttachment> portalAttachments
    ) {
        public StructurePlan {
            topology = topology == null ? TraversalTopology.empty() : topology;
            guideNodes = guideNodes == null ? List.of() : List.copyOf(guideNodes);
            guideEdges = guideEdges == null ? List.of() : List.copyOf(guideEdges);
            portalAttachments = normalizePortalAttachments(portalAttachments);
        }

        public static StructurePlan empty() {
            return new StructurePlan(TraversalTopology.empty(), List.of(), List.of(), List.of());
        }

        public boolean hasWaypointBackbone() {
            for (TraversalNode guideNode : guideNodes) {
                if (guideNode != null && guideNode.kind() == TraversalNode.TraversalNodeKind.WAYPOINT) {
                    return true;
                }
            }
            return false;
        }

        public List<TraversalNodeId> attachedPortalNodeIds() {
            if (portalAttachments.isEmpty()) {
                return List.of();
            }
            ArrayList<TraversalNodeId> result = new ArrayList<>();
            for (PortalAttachment portalAttachment : portalAttachments) {
                if (portalAttachment != null && portalAttachment.portalNodeId() != null) {
                    result.add(portalAttachment.portalNodeId());
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        public PortalAttachment portalAttachment(TraversalNodeId portalNodeId) {
            if (portalNodeId == null) {
                return null;
            }
            for (PortalAttachment portalAttachment : portalAttachments) {
                if (portalAttachment != null && portalNodeId.equals(portalAttachment.portalNodeId())) {
                    return portalAttachment;
                }
            }
            return null;
        }

        private static List<PortalAttachment> normalizePortalAttachments(List<PortalAttachment> portalAttachments) {
            if (portalAttachments == null || portalAttachments.isEmpty()) {
                return List.of();
            }
            LinkedHashMap<TraversalNodeId, PortalAttachment> result = new LinkedHashMap<>();
            for (PortalAttachment portalAttachment : portalAttachments) {
                if (portalAttachment == null || portalAttachment.portalNodeId() == null) {
                    continue;
                }
                result.putIfAbsent(portalAttachment.portalNodeId(), portalAttachment);
            }
            return result.isEmpty() ? List.of() : List.copyOf(result.values());
        }
    }

    public record PortalAttachment(
            TraversalNodeId portalNodeId,
            TraversalNodeId targetNodeId,
            TraversalEdge edge
    ) {
        public PortalAttachment {
            Objects.requireNonNull(portalNodeId, "portalNodeId");
            Objects.requireNonNull(targetNodeId, "targetNodeId");
            Objects.requireNonNull(edge, "edge");
            if (!connects(edge, portalNodeId, targetNodeId)) {
                throw new IllegalArgumentException("attachment edge must connect portal and target");
            }
        }

        private static boolean connects(
                TraversalEdge edge,
                TraversalNodeId portalNodeId,
                TraversalNodeId targetNodeId
        ) {
            if (edge == null || portalNodeId == null || targetNodeId == null) {
                return false;
            }
            Set<TraversalNodeId> nodeIds = Set.of(edge.startNodeId(), edge.endNodeId());
            return nodeIds.contains(portalNodeId) && nodeIds.contains(targetNodeId);
        }
    }
}
