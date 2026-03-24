package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.Collection;
import java.util.List;
import java.util.Objects;

public final class Door extends VertexPath {

    // A door is a shared boundary object between exactly two structure sides.
    private final TraversalState traversalState;
    private final List<DoorSide> sides;

    public Door(Collection<VertexEdge> edges) {
        this(edges, TraversalState.CLOSED, List.of());
    }

    public Door(Collection<VertexEdge> edges, TraversalState traversalState) {
        this(edges, traversalState, List.of());
    }

    public Door(Collection<VertexEdge> edges, TraversalState traversalState, Collection<DoorSide> sides) {
        super(edges);
        this.traversalState = traversalState == null ? TraversalState.CLOSED : traversalState;
        List<DoorSide> resolvedSides = sides == null ? List.of() : sides.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (resolvedSides.size() > 2) {
            throw new IllegalArgumentException("Eine Tür darf höchstens zwei Seiten haben");
        }
        this.sides = List.copyOf(resolvedSides);
    }

    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Door(edges, traversalState, sides);
    }

    public Door movedBy(Point2i delta) {
        return (Door) translated(delta);
    }

    public TraversalState traversalState() {
        return traversalState;
    }

    public List<DoorSide> sides() {
        return sides;
    }

    public boolean touches(DoorSide side) {
        return side != null && sides.contains(side);
    }

    public DoorSide oppositeOf(DoorSide side) {
        if (side == null || sides.size() != 2 || !sides.contains(side)) {
            return null;
        }
        return sides.get(0).equals(side) ? sides.get(1) : sides.get(0);
    }

    public boolean blocksTraversal() {
        return traversalState.blocksTraversal();
    }

    public record DoorSide(SideType type, Long id) {
        public DoorSide {
            type = type == null ? SideType.CLUSTER : type;
        }

        public static DoorSide room(Long roomId) {
            return new DoorSide(SideType.ROOM, roomId);
        }

        public static DoorSide corridor(Long corridorId) {
            return new DoorSide(SideType.CORRIDOR, corridorId);
        }

        public static DoorSide cluster(Long clusterId) {
            return new DoorSide(SideType.CLUSTER, clusterId);
        }
    }

    public enum SideType {
        ROOM,
        CORRIDOR,
        CLUSTER
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
