package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

public final class Door {

    private final DoorState doorState;
    private final List<GridSegment2x> segments2x;

    public Door(Collection<GridSegment2x> segments) {
        this(segments, DoorState.CLOSED);
    }

    public Door(Collection<GridSegment2x> segments, DoorState doorState) {
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
        this.segments2x = normalizeSegments(segments);
    }

    public static Door fromSegments(Collection<GridSegment2x> segments, DoorState doorState) {
        return new Door(segments, doorState);
    }

    public Door movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Door(segments2x.stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList(), doorState);
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

    private static List<GridSegment2x> normalizeSegments(Collection<GridSegment2x> segments) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment : GridSegment2x.boundarySteps(segments).stream()
                .sorted(GridSegment2x.ORDER)
                .toList()) {
            if (!segment.isBoundaryEdge()) {
                throw new IllegalArgumentException("Door segments must be boundary edges");
            }
            result.add(segment);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
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
