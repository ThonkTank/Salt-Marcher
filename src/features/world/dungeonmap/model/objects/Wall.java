package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

public final class Wall {

    private final List<LegacyGridSegment2x> segments2x;

    // A wall is just a normalized 2x boundary path whose domain rule is that passage is always blocked.
    public Wall(Collection<LegacyGridSegment2x> segments) {
        this.segments2x = normalizeSegments(segments);
    }

    public static Wall fromSegments(Collection<LegacyGridSegment2x> segments) {
        return new Wall(segments);
    }

    public List<LegacyGridSegment2x> segments2x() {
        return segments2x;
    }

    public Wall movedBy(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Wall(segments2x.stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList());
    }

    public boolean blocksPassage() {
        return true;
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
}
