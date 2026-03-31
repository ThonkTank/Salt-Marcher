package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.Collection;

public final class Door extends VertexPath {

    private final DoorState doorState;

    public Door(Collection<VertexEdge> edges) {
        this(edges, DoorState.CLOSED);
    }

    public Door(Collection<VertexEdge> edges, DoorState doorState) {
        super(edges);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Door(edges, doorState);
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

    public enum DoorState {
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
