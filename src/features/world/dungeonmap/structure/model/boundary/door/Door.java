package features.world.dungeonmap.structure.model.boundary.door;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical single-door owner beneath {@code boundary}.
 *
 * <p>Door-specific clipping, segment removal, anchor repair, and persistence-facing segment access stay here so
 * callers do not rebuild door edits from generic boundary-shape surgery.</p>
 */

public final class Door extends EdgeShape {

    private final Long doorId;
    private final GridSegment2x anchorSegment2x;
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
        super(EdgeShape.normalizeBoundarySegments(segments));
        this.doorId = doorId;
        this.anchorSegment2x = resolveAnchorSegment(anchorSegment2x, segments2x());
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
    }

    public Door(EdgeShape shape, DoorState doorState) {
        this(null, shape, null, doorState);
    }

    public Door(EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        this(null, shape, anchorSegment2x, doorState);
    }

    public Door(Long doorId, EdgeShape shape, GridSegment2x anchorSegment2x, DoorState doorState) {
        this(doorId, shape == null ? List.of() : shape.segments2x(), anchorSegment2x, doorState);
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
        return doorId;
    }

    public GridSegment2x anchorSegment2x() {
        return anchorSegment2x;
    }

    public GridSegment2x persistedAnchorSegment2x() {
        return anchorSegment2x == null ? firstSegment2x() : anchorSegment2x;
    }

    public Set<GridSegment2x> boundarySegments() {
        Set<GridSegment2x> segments = segmentSet2x();
        return segments.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments));
    }

    public List<GridSegment2x> orderedBoundarySegments() {
        return boundarySegments().stream()
                .sorted(GridSegment2x.ORDER)
                .toList();
    }

    public boolean hasBoundarySegment(GridSegment2x segment2x) {
        return segment2x != null && contains(segment2x);
    }

    public boolean hasBoundarySegments() {
        return !isEmpty();
    }

    public Door movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Door(doorId, segments2x().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList(),
                anchorSegment2x == null ? null : anchorSegment2x.translatedByCells(resolvedDelta),
                doorState);
    }

    public Door withDoorId(Long doorId) {
        if (java.util.Objects.equals(this.doorId, doorId)) {
            return this;
        }
        return new Door(doorId, segments2x(), anchorSegment2x, doorState);
    }

    public Door withDoorState(DoorState doorState) {
        DoorState resolvedDoorState = doorState == null ? DoorState.CLOSED : doorState;
        if (resolvedDoorState == this.doorState) {
            return this;
        }
        return new Door(doorId, segments2x(), anchorSegment2x, resolvedDoorState);
    }

    public Door clippedToBoundary(Collection<GridSegment2x> boundarySegments) {
        if (!hasBoundarySegments()) {
            return null;
        }
        EdgeShape boundaryShape = EdgeShape.fromBoundarySegments(boundarySegments);
        if (boundaryShape.isEmpty()) {
            return null;
        }
        EdgeShape clippedShape = boundaryShape.intersection(boundarySegments());
        if (clippedShape.isEmpty()) {
            return null;
        }
        GridSegment2x clippedAnchor = clippedShape.contains(anchorSegment2x)
                ? anchorSegment2x
                : clippedShape.firstSegment2x();
        return Door.fromShape(doorId, clippedShape, clippedAnchor, doorState);
    }

    public Door withoutBoundarySegments(Collection<GridSegment2x> removedBoundarySegments) {
        if (!hasBoundarySegments()) {
            return null;
        }
        EdgeShape remainingShape = EdgeShape.fromBoundarySegments(boundarySegments()).without(removedBoundarySegments);
        List<EdgeShape> components = remainingShape.connectedComponents();
        if (components.size() > 1) {
            throw new IllegalArgumentException("Door edit would split an existing door");
        }
        if (components.isEmpty()) {
            return null;
        }
        EdgeShape remainingComponent = components.getFirst();
        GridSegment2x repairedAnchor = remainingComponent.contains(anchorSegment2x)
                ? anchorSegment2x
                : remainingComponent.firstSegment2x();
        return Door.fromShape(doorId, remainingComponent, repairedAnchor, doorState);
    }

    public static List<Door> fromBoundaryComponents(
            Collection<GridSegment2x> boundarySegments,
            DoorState doorState
    ) {
        EdgeShape shape = EdgeShape.fromBoundarySegments(boundarySegments);
        if (shape.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (EdgeShape component : shape.connectedComponents()) {
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

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Door door)) {
            return false;
        }
        return Objects.equals(doorId, door.doorId)
                && Objects.equals(segments2x(), door.segments2x())
                && Objects.equals(anchorSegment2x, door.anchorSegment2x)
                && doorState == door.doorState;
    }

    @Override
    public int hashCode() {
        return Objects.hash(doorId, segments2x(), anchorSegment2x, doorState);
    }
}
