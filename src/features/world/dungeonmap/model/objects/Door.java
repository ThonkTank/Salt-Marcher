package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.Collection;

public final class Door extends VertexPath {

    // A door is geometry plus traversal state. Geometry lives in VertexPath; Door adds only passage semantics.
    private final TraversalState traversalState;

    public Door(Collection<VertexEdge> edges) {
        this(edges, TraversalState.CLOSED);
    }

    public Door(Collection<VertexEdge> edges, TraversalState traversalState) {
        super(edges);
        this.traversalState = traversalState == null ? TraversalState.CLOSED : traversalState;
    }

    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Door(edges, traversalState);
    }

    public Door movedBy(Point2i delta) {
        return (Door) translated(delta);
    }

    public TraversalState traversalState() {
        return traversalState;
    }

    public boolean blocksTraversal() {
        return traversalState.blocksTraversal();
    }

    public enum TraversalState {
        CLOSED(true);

        private final boolean blocksTraversal;

        TraversalState(boolean blocksTraversal) {
            this.blocksTraversal = blocksTraversal;
        }

        public boolean blocksTraversal() {
            return blocksTraversal;
        }
    }
}
