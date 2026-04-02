package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

public final class Door {

    private final DoorState doorState;
    private final List<LegacyGridSegment2x> segments2x;

    public Door(Collection<LegacyGridSegment2x> segments) {
        this(segments, DoorState.CLOSED);
    }

    public Door(Collection<LegacyGridSegment2x> segments, DoorState doorState) {
        this.doorState = doorState == null ? DoorState.CLOSED : doorState;
        this.segments2x = normalizeSegments(segments);
    }

    public static Door fromSegments(Collection<LegacyGridSegment2x> segments, DoorState doorState) {
        return new Door(segments, doorState);
    }

    public Door movedBy(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
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

    public List<LegacyGridSegment2x> segments2x() {
        return segments2x;
    }

    private static List<LegacyGridSegment2x> normalizeSegments(Collection<LegacyGridSegment2x> segments) {
        LinkedHashSet<LegacyGridSegment2x> result = new LinkedHashSet<>();
        if (segments != null) {
            segments.stream()
                    .filter(segment -> segment != null)
                    .sorted(LegacyGridSegment2x.SEGMENT_ORDER)
                    .forEach(result::add);
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
