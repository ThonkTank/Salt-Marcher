package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

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
        ArrayList<TraversalEdgeId> selectedEdgeIds = new ArrayList<>();
        LinkedHashSet<TraversalNodeId> connectedNodeIds = new LinkedHashSet<>();
        LinkedHashSet<TraversalNodeId> requiredNodeIds = requiredNodeIds(requiredNodes);
        TraversalNode seedNode = requiredNodes.getFirst();
        connectedNodeIds.add(seedNode.nodeId());
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
            selectedEdgeIds.add(nextEdge.edgeId());
            connectedNodeIds.add(nextNodeId);
        }
        return new StructurePlan(topology, candidateGraph, selectedEdgeIds);
    }

    private static StructurePlan planWaypointBackbone(
            TraversalTopology topology,
            TraversalCandidateGraphBuilder.CandidateGraph candidateGraph
    ) {
        List<TraversalNode> waypointNodes = topology == null ? List.of() : topology.requiredWaypointNodes();
        if (waypointNodes.isEmpty()) {
            return StructurePlan.empty();
        }
        ArrayList<TraversalEdgeId> selectedEdgeIds = new ArrayList<>(candidateGraph.waypointSpineEdgeIds());
        if (waypointNodes.size() > 1 && selectedEdgeIds.size() != waypointNodes.size() - 1) {
            return new StructurePlan(topology, candidateGraph, selectedEdgeIds);
        }
        for (TraversalNode roomPortalNode : topology.requiredRoomPortalNodes()) {
            TraversalEdgeId attachmentEdgeId = selectBestPortalAttachmentEdgeId(candidateGraph, roomPortalNode, waypointNodes);
            if (attachmentEdgeId != null) {
                selectedEdgeIds.add(attachmentEdgeId);
            }
        }
        return new StructurePlan(topology, candidateGraph, selectedEdgeIds);
    }

    private static TraversalEdgeId selectBestPortalAttachmentEdgeId(
            TraversalCandidateGraphBuilder.CandidateGraph candidateGraph,
            TraversalNode roomPortalNode,
            List<TraversalNode> spineNodes
    ) {
        if (roomPortalNode == null || spineNodes == null || spineNodes.isEmpty()) {
            return null;
        }
        TraversalNode bestTarget = null;
        TraversalEdge bestEdge = null;
        for (TraversalNode spineNode : spineNodes) {
            TraversalEdge candidateEdge = candidateGraph.edgeBetween(
                    roomPortalNode.nodeId(),
                    spineNode == null ? null : spineNode.nodeId());
            if (candidateEdge == null || !isBetterEdge(candidateEdge, bestEdge, spineNode.nodeId(), bestTarget == null ? null : bestTarget.nodeId())) {
                continue;
            }
            bestTarget = spineNode;
            bestEdge = candidateEdge;
        }
        return bestTarget == null || bestEdge == null || bestEdge.edgeId() == null
                ? null
                : bestEdge.edgeId();
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
        return edge == null || edge.edgeId() == null ? null : edge.edgeId().otherNodeId(nodeId);
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
            TraversalCandidateGraphBuilder.CandidateGraph candidateGraph,
            List<TraversalEdgeId> selectedEdgeIds
    ) {
        public StructurePlan {
            topology = topology == null ? TraversalTopology.empty() : topology;
            candidateGraph = candidateGraph == null ? TraversalCandidateGraphBuilder.CandidateGraph.empty() : candidateGraph;
            selectedEdgeIds = normalizeSelectedEdgeIds(selectedEdgeIds);
        }

        public static StructurePlan empty() {
            return new StructurePlan(
                    TraversalTopology.empty(),
                    TraversalCandidateGraphBuilder.CandidateGraph.empty(),
                    List.of());
        }

        private static List<TraversalEdgeId> normalizeSelectedEdgeIds(List<TraversalEdgeId> selectedEdgeIds) {
            if (selectedEdgeIds == null || selectedEdgeIds.isEmpty()) {
                return List.of();
            }
            LinkedHashSet<TraversalEdgeId> result = new LinkedHashSet<>();
            for (TraversalEdgeId edgeId : selectedEdgeIds) {
                if (edgeId == null) {
                    continue;
                }
                result.add(edgeId);
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }
}
