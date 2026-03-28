package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.ArrayList;
import java.util.List;

public final class TraversalStructurePlanner {

    private TraversalStructurePlanner() {
        throw new AssertionError("No instances");
    }

    public static StructurePlan plan(TraversalTopology topology) {
        TraversalTopology resolvedTopology = topology == null ? TraversalTopology.empty() : topology;
        return new StructurePlan(
                resolvedTopology,
                resolvedTopology.backboneNodes(),
                resolvedTopology.edges(),
                resolvedTopology.attachedPortalNodeIds());
    }

    public record StructurePlan(
            TraversalTopology topology,
            List<TraversalNode> guideNodes,
            List<TraversalEdge> guideEdges,
            List<TraversalNodeId> attachedPortalNodeIds
    ) {
        public StructurePlan {
            topology = topology == null ? TraversalTopology.empty() : topology;
            guideNodes = guideNodes == null ? List.of() : List.copyOf(guideNodes);
            guideEdges = guideEdges == null ? List.of() : List.copyOf(guideEdges);
            attachedPortalNodeIds = normalizeAttachedPortalNodeIds(attachedPortalNodeIds);
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

        private static List<TraversalNodeId> normalizeAttachedPortalNodeIds(List<TraversalNodeId> attachedPortalNodeIds) {
            if (attachedPortalNodeIds == null || attachedPortalNodeIds.isEmpty()) {
                return List.of();
            }
            ArrayList<TraversalNodeId> result = new ArrayList<>();
            for (TraversalNodeId nodeId : attachedPortalNodeIds) {
                if (nodeId != null) {
                    result.add(nodeId);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }
}
