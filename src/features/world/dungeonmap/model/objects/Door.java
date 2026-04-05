package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;

public final class Door extends EdgeShape {

    private final DoorState doorState;

    public Door(Collection<GridSegment2x> segments) {
        this(segments, DoorState.CLOSED);
    }

    public Door(Collection<GridSegment2x> segments, DoorState doorState) {
        super(EdgeShape.normalizeBoundarySegments(segments));
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, DoorState doorState) {
        return new Door(segments, doorState);
    }

    public Door movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Door(segments2x().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList(), doorState);
    }

    public DoorState doorState() {
        return doorState;
    }

    public boolean blocksPassage() {
        return doorState.blocksPassage();
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
