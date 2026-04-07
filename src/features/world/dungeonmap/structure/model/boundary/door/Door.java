package features.world.dungeonmap.structure.model.boundary.door;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.structure.model.boundary.BoundaryObject;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Canonical single-door owner beneath {@code boundary}.
 *
 * <p>Door-specific clipping, segment removal, anchor repair, and persistence-facing segment access stay here so
 * callers do not rebuild door edits from generic boundary-shape surgery.</p>
 */

public final class Door extends BoundaryObject {

    private final DoorState doorState;

    public Door(Collection<GridSegment2x> segments) {
        this(null, segments, null, DoorState.CLOSED);
    }

    public Door(Collection<GridSegment2x> segments, DoorState doorState) {
        this(null, segments, null, doorState);
    }

    public Door(Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, DoorState doorState) {
        this(null, segments, anchorSegment2x, doorState);
    }

    public Door(Long doorId, Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, DoorState doorState) {
        super(doorId, segments, anchorSegment2x);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public Door(EdgeShape shape, DoorState doorState) {
        this(null, shape, null, doorState);
    }

    public Door(EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        this(null, shape, anchorSegment2x, doorState);
    }

    public Door(Long doorId, EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        super(doorId, shape, anchorSegment2x);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, DoorState doorState) {
        return new Door(null, segments, null, doorState);
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, DoorState doorState) {
        return new Door(null, segments, anchorSegment2x, doorState);
    }

    public static Door fromSegments(Long doorId, Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, DoorState doorState) {
        return new Door(doorId, segments, anchorSegment2x, doorState);
    }

    public static Door fromShape(EdgeShape shape, DoorState doorState) {
        return new Door(null, shape, null, doorState);
    }

    public static Door fromShape(EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        return new Door(null, shape, anchorSegment2x, doorState);
    }

    public static Door fromShape(Long doorId, EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        return new Door(doorId, shape, anchorSegment2x, doorState);
    }

    public Long doorId() {
        return objectId();
    }

    public GridSegment2x anchorSegment2x() {
        return anchorSegment2xInternal();
    }

    public Door movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Door(doorId(), translatedBoundarySegments(resolvedDelta), translatedAnchorSegment2x(resolvedDelta),
                doorState);
    }

    public Door withDoorId(Long doorId) {
        if (Objects.equals(doorId(), doorId)) {
            return this;
        }
        return new Door(doorId, segments2x(), anchorSegment2x(), doorState);
    }

    public Door withDoorState(DoorState doorState) {
        DoorState resolvedDoorState = doorState == null ? DoorState.CLOSED : doorState;
        if (resolvedDoorState == this.doorState) {
            return this;
        }
        return new Door(doorId(), segments2x(), anchorSegment2x(), resolvedDoorState);
    }

    public Door clippedToBoundary(Collection<GridSegment2x> boundarySegments) {
        EdgeShape clippedShape = clippedBoundaryShape(boundarySegments);
        if (clippedShape.isEmpty()) {
            return null;
        }
        return Door.fromShape(doorId(), clippedShape, repairedAnchorSegment2x(clippedShape), doorState);
    }

    public Door withoutBoundarySegments(Collection<GridSegment2x> removedBoundarySegments) {
        List<EdgeShape> components = remainingBoundaryComponents(removedBoundarySegments);
        if (components.size() > 1) {
            throw new IllegalArgumentException("Door edit would split an existing door");
        }
        if (components.isEmpty()) {
            return null;
        }
        EdgeShape remainingComponent = components.getFirst();
        return Door.fromShape(doorId(), remainingComponent, repairedAnchorSegment2x(remainingComponent), doorState);
    }

    public static List<Door> fromBoundaryComponents(
            Collection<GridSegment2x> boundarySegments,
            DoorState doorState
    ) {
        ArrayList<Door> result = new ArrayList<>();
        for (EdgeShape component : boundaryComponents(boundarySegments)) {
            if (!component.isEmpty()) {
                result.add(Door.fromShape(component, component.firstSegment2x(), doorState));
            }
        }
        result.sort(Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
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

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Door door)) {
            return false;
        }
        return sameBaseState(door) && doorState == door.doorState;
    }

    @Override
    public int hashCode() {
        return Objects.hash(baseHashCode(), doorState);
    }
}
