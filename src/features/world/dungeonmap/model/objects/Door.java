package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CompositeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.GridShape;
import features.world.dungeonmap.model.geometry.GridShapes;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public final class Door extends VertexPath implements DungeonObject {

    private final DoorState doorState;
    private final List<GridSegment2x> segments2x;

    public Door(Collection<VertexEdge> edges) {
        this(edges, DoorState.CLOSED);
    }

    public Door(Collection<VertexEdge> edges, DoorState doorState) {
        super(edges);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
        this.segments2x = edges().stream()
                .map(GridSegment2x::fromVertexEdge)
                .sorted(GridSegment2x.SEGMENT_ORDER)
                .toList();
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, DoorState doorState) {
        ArrayList<VertexEdge> edges = new ArrayList<>();
        if (segments != null) {
            segments.stream()
                    .filter(segment -> segment != null)
                    .sorted(GridSegment2x.SEGMENT_ORDER)
                    .forEach(segment -> segment.toVertexEdge().ifPresent(edges::add));
        }
        return new Door(edges, doorState);
    }

    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Door(edges, doorState);
    }

    @Override
    public GridShape shape2x() {
        if (segments2x.isEmpty()) {
            return new CompositeShape(List.of());
        }
        return GridShapes.union(segments2x.stream().map(GridShapes::edge).toList());
    }

    public Door movedBy(Point2i delta) {
        return (Door) translated(delta);
    }

    public DoorState doorState() {
        return doorState;
    }

    public boolean blocksPassage() {
        return doorState.blocksPassage();
    }

    public List<GridSegment2x> segments2x() {
        return segments2x;
    }

    public enum DoorState {
        OPEN(false),
        CLOSED(true);

        private final boolean blocksPassage;

        DoorState(boolean blocksPassage) {
            this.blocksPassage = blocksPassage;
        }

        public boolean blocksPassage() {
            return blocksPassage;
        }
    }
}
