package features.world.dungeon.dungoenmap.structure.model.boundary.door;

import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungoenmap.structure.model.boundary.BoundaryObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class Door extends BoundaryObject {

    private final DoorState doorState;

    private Door(Long doorId, GridBoundary boundary, GridSegment anchorSegment, DoorState doorState) {
        super(doorId, boundary, anchorSegment);
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public static Door fromBoundary(GridBoundary boundary, DoorState doorState) {
        return new Door(null, boundary, null, doorState);
    }

    public static Door fromBoundary(GridBoundary boundary, GridSegment anchorSegment, DoorState doorState) {
        return new Door(null, boundary, anchorSegment, doorState);
    }

    public static Door fromBoundary(Long doorId, GridBoundary boundary, GridSegment anchorSegment, DoorState doorState) {
        return new Door(doorId, boundary, anchorSegment, doorState);
    }

    public Long doorId() {
        return objectId();
    }

    public GridSegment anchorSegment() {
        return anchorSegmentInternal();
    }

    public Door movedBy(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero()
                ? this
                : new Door(doorId(), GridBoundary.of(translatedBoundarySegments(resolvedTranslation)),
                translatedAnchorSegment(resolvedTranslation), doorState);
    }

    public Door withDoorId(Long doorId) {
        return Objects.equals(doorId(), doorId)
                ? this
                : new Door(doorId, GridBoundary.of(orderedBoundarySegments()), anchorSegment(), doorState);
    }

    public Door withDoorState(DoorState doorState) {
        DoorState resolvedDoorState = doorState == null ? DoorState.CLOSED : doorState;
        return resolvedDoorState == this.doorState
                ? this
                : new Door(doorId(), GridBoundary.of(orderedBoundarySegments()), anchorSegment(), resolvedDoorState);
    }

    public Door clippedToBoundary(GridBoundary boundarySegments) {
        GridBoundary clippedBoundary = clippedBoundary(boundarySegments);
        return clippedBoundary.isEmpty()
                ? null
                : Door.fromBoundary(doorId(), clippedBoundary, repairedAnchorSegment(clippedBoundary), doorState);
    }

    public Door withoutBoundarySegments(GridBoundary removedBoundarySegments) {
        List<GridBoundary> components = remainingBoundaryComponents(removedBoundarySegments);
        if (components.size() > 1) {
            throw new IllegalArgumentException("Door edit would split an existing door");
        }
        if (components.isEmpty()) {
            return null;
        }
        GridBoundary remainingComponent = components.getFirst();
        return Door.fromBoundary(doorId(), remainingComponent, repairedAnchorSegment(remainingComponent), doorState);
    }

    public static List<Door> fromBoundaryComponents(GridBoundary boundarySegments, DoorState doorState) {
        ArrayList<Door> result = new ArrayList<>();
        for (GridBoundary component : boundaryComponents(boundarySegments)) {
            if (!component.isEmpty()) {
                GridSegment anchorSegment = component.segments().stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
                result.add(Door.fromBoundary(component, anchorSegment, doorState));
            }
        }
        result.sort(Comparator.comparing(Door::anchorSegment, GridSegment.ORDER));
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
