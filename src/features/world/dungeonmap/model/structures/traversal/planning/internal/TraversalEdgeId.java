package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.Objects;

public record TraversalEdgeId(
        TraversalNodeId firstNodeId,
        TraversalNodeId secondNodeId
) {
    public TraversalEdgeId {
        Objects.requireNonNull(firstNodeId, "firstNodeId");
        Objects.requireNonNull(secondNodeId, "secondNodeId");
        if (firstNodeId.equals(secondNodeId)) {
            throw new IllegalArgumentException("edge must connect distinct nodes");
        }
        if (firstNodeId.value().compareTo(secondNodeId.value()) > 0) {
            TraversalNodeId swap = firstNodeId;
            firstNodeId = secondNodeId;
            secondNodeId = swap;
        }
    }

    public static TraversalEdgeId of(
            TraversalNodeId firstNodeId,
            TraversalNodeId secondNodeId
    ) {
        if (firstNodeId == null
                || secondNodeId == null
                || firstNodeId.equals(secondNodeId)) {
            return null;
        }
        return new TraversalEdgeId(firstNodeId, secondNodeId);
    }

    public boolean contains(TraversalNodeId nodeId) {
        return nodeId != null && (firstNodeId.equals(nodeId) || secondNodeId.equals(nodeId));
    }

    public TraversalNodeId otherNodeId(TraversalNodeId nodeId) {
        if (nodeId == null) {
            return null;
        }
        if (firstNodeId.equals(nodeId)) {
            return secondNodeId;
        }
        if (secondNodeId.equals(nodeId)) {
            return firstNodeId;
        }
        return null;
    }
}
