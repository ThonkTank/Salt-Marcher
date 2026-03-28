package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.Objects;

public record TraversalEdge(
        TraversalNodeId startNodeId,
        TraversalNodeId endNodeId
) {
    public TraversalEdge {
        Objects.requireNonNull(startNodeId, "startNodeId");
        Objects.requireNonNull(endNodeId, "endNodeId");
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("edge must connect distinct nodes");
        }
    }
}
