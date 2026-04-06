package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;
import java.util.List;

public final class Door extends EdgeShape {

    private final GridSegment2x anchorSegment2x;
    private final DoorState doorState;

    public Door(Collection<GridSegment2x> segments) {
        this(segments, null, DoorState.CLOSED);
    }

    public Door(Collection<GridSegment2x> segments, DoorState doorState) {
        this(segments, null, doorState);
    }

    public Door(Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, DoorState doorState) {
        super(EdgeShape.normalizeBoundarySegments(segments));
        this.anchorSegment2x = resolveAnchorSegment(anchorSegment2x, segments2x());
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public Door(EdgeShape shape, DoorState doorState) {
        this(shape, null, doorState);
    }

    public Door(EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        this(shape == null ? List.of() : shape.segments2x(), anchorSegment2x, doorState);
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, DoorState doorState) {
        return new Door(segments, null, doorState);
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, DoorState doorState) {
        return new Door(segments, anchorSegment2x, doorState);
    }

    public static Door fromShape(EdgeShape shape, DoorState doorState) {
        return new Door(shape, null, doorState);
    }

    public static Door fromShape(EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        return new Door(shape, anchorSegment2x, doorState);
    }

    public GridSegment2x anchorSegment2x() {
        return anchorSegment2x;
    }

    public Door movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Door(segments2x().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList(),
                anchorSegment2x == null ? null : anchorSegment2x.translatedByCells(resolvedDelta),
                doorState);
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

    private static GridSegment2x resolveAnchorSegment(
            GridSegment2x requestedAnchorSegment2x,
            List<GridSegment2x> segments2x
    ) {
        if (requestedAnchorSegment2x != null && segments2x.contains(requestedAnchorSegment2x)) {
            return requestedAnchorSegment2x;
        }
        return segments2x.stream()
                .sorted(GridSegment2x.ORDER)
                .findFirst()
                .orElse(null);
    }
}
