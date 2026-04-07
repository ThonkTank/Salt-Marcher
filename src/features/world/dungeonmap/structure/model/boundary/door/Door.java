package features.world.dungeonmap.structure.model.boundary.door;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.structure.model.boundary.BoundaryObject;
import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridSegment;

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

    private Door(Collection<GridSegment> segments) {
        this(null, segments, null, DoorState.CLOSED);
    }

    private Door(Collection<GridSegment> segments, DoorState doorState) {
        this(null, segments, null, doorState);
    }

    private Door(Collection<GridSegment> segments, GridSegment anchorSegment2x, DoorState doorState) {
        this(null, segments, anchorSegment2x, doorState);
    }

    private Door(Long doorId, Collection<GridSegment> segments, GridSegment anchorSegment2x, DoorState doorState) {
        super(doorId, segments, anchorSegment2x);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    private Door(GridBoundary shape, DoorState doorState) {
        this(null, shape, null, doorState);
    }

    private Door(GridBoundary shape, GridSegment anchorSegment2x, DoorState doorState) {
        this(null, shape, anchorSegment2x, doorState);
    }

    private Door(Long doorId, GridBoundary shape, GridSegment anchorSegment2x, DoorState doorState) {
        super(doorId, shape, anchorSegment2x);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public static Door fromSegments(Collection<GridSegment> segments, DoorState doorState) {
        return new Door(null, segments, null, doorState);
    }

    public static Door fromSegments(Collection<GridSegment> segments, GridSegment anchorSegment2x, DoorState doorState) {
        return new Door(null, segments, anchorSegment2x, doorState);
    }

    public static Door fromSegments(Long doorId, Collection<GridSegment> segments, GridSegment anchorSegment2x, DoorState doorState) {
        return new Door(doorId, segments, anchorSegment2x, doorState);
    }

    public static Door fromShape(GridBoundary shape, DoorState doorState) {
        return new Door(null, shape, null, doorState);
    }

    public static Door fromShape(GridBoundary shape, GridSegment anchorSegment2x, DoorState doorState) {
        return new Door(null, shape, anchorSegment2x, doorState);
    }

    public static Door fromShape(Long doorId, GridBoundary shape, GridSegment anchorSegment2x, DoorState doorState) {
        return new Door(doorId, shape, anchorSegment2x, doorState);
    }

    public Long doorId() {
        return objectId();
    }

    public GridSegment anchorSegment2x() {
        return anchorSegment2xInternal();
    }

    public Door movedBy(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
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
        return new Door(doorId, orderedBoundarySegments(), anchorSegment2x(), doorState);
    }

    public Door withDoorState(DoorState doorState) {
        DoorState resolvedDoorState = doorState == null ? DoorState.CLOSED : doorState;
        if (resolvedDoorState == this.doorState) {
            return this;
        }
        return new Door(doorId(), orderedBoundarySegments(), anchorSegment2x(), resolvedDoorState);
    }

    public Door clippedToBoundary(Collection<GridSegment> boundarySegments) {
        GridBoundary clippedShape = clippedBoundaryShape(boundarySegments);
        if (clippedShape.isEmpty()) {
            return null;
        }
        return Door.fromShape(doorId(), clippedShape, repairedAnchorSegment2x(clippedShape), doorState);
    }

    public Door withoutBoundarySegments(Collection<GridSegment> removedBoundarySegments) {
        List<GridBoundary> components = remainingBoundaryComponents(removedBoundarySegments);
        if (components.size() > 1) {
            throw new IllegalArgumentException("Door edit would split an existing door");
        }
        if (components.isEmpty()) {
            return null;
        }
        GridBoundary remainingComponent = components.getFirst();
        return Door.fromShape(doorId(), remainingComponent, repairedAnchorSegment2x(remainingComponent), doorState);
    }

    public static List<Door> fromBoundaryComponents(
            Collection<GridSegment> boundarySegments,
            DoorState doorState
    ) {
        ArrayList<Door> result = new ArrayList<>();
        for (GridBoundary component : boundaryComponents(boundarySegments)) {
            if (!component.isEmpty()) {
                result.add(Door.fromShape(component, component.firstSegment2x(), doorState));
            }
        }
        result.sort(Comparator.comparing(Door::anchorSegment2x, GridSegment.ORDER));
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
