package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.Objects;

public record HorizontalTraversalEdge(
        TraversalNodeId startNodeId,
        TraversalNodeId endNodeId,
        long costHint
) implements TraversalEdge {

    public HorizontalTraversalEdge {
        Objects.requireNonNull(startNodeId, "startNodeId");
        Objects.requireNonNull(endNodeId, "endNodeId");
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("edge must connect distinct nodes");
        }
        if (costHint < 0L) {
            throw new IllegalArgumentException("costHint must not be negative");
        }
    }

    @Override
    public TraversalEdgeKind kind() {
        return TraversalEdgeKind.HORIZONTAL;
    }
}
