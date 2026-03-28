package features.world.dungeonmap.model.structures.traversal.planning.internal;

public sealed interface TraversalEdge permits HorizontalTraversalEdge, VerticalCandidateEdge {

    TraversalNodeId startNodeId();

    TraversalNodeId endNodeId();

    long costHint();

    TraversalEdgeKind kind();

    enum TraversalEdgeKind {
        HORIZONTAL,
        VERTICAL_CANDIDATE
    }
}
