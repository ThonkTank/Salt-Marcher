package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.Collection;

public final class Door extends VertexPath implements BoundaryObject {

    // A door is geometry plus traversal state. Geometry lives in VertexPath; Door adds only passage semantics.
    private final TraversalState traversalState;

    public Door(Collection<VertexEdge> edges) {
        this(edges, TraversalState.CLOSED);
    }

    public Door(Collection<VertexEdge> edges, TraversalState traversalState) {
        super(edges);
        this.traversalState = traversalState == null ? TraversalState.CLOSED : traversalState;
    }

    @Override
    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Door(edges, traversalState);
    }

    @Override
    public VertexPath path() {
        return this;
    }

    public Door movedBy(Point2i delta) {
        return (Door) translated(delta);
    }

    public static Door between(Point2i start, Point2i end) {
        return new Door(java.util.Set.of(new VertexEdge(start, end)));
    }

    public TraversalState traversalState() {
        return traversalState;
    }

    @Override
    public boolean blocksTraversal() {
        return traversalState.blocksTraversal();
    }

    public boolean isPassable() {
        return !blocksTraversal();
    }

    public boolean isOpen() {
        return traversalState == TraversalState.OPEN;
    }

    public boolean isClosed() {
        return traversalState == TraversalState.CLOSED;
    }

    public boolean isLocked() {
        return traversalState == TraversalState.LOCKED;
    }

    public Door withTraversalState(TraversalState traversalState) {
        return new Door(edges(), traversalState);
    }

    public enum TraversalState {
        OPEN(false),
        CLOSED(true),
        LOCKED(true);

        private final boolean blocksTraversal;

        TraversalState(boolean blocksTraversal) {
            this.blocksTraversal = blocksTraversal;
        }

        public boolean blocksTraversal() {
            return blocksTraversal;
        }
    }
}
