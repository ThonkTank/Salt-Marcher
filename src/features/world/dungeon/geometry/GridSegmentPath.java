package features.world.dungeon.geometry;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GridSegmentPath extends GridObject<GridSegmentPath> implements GridBounded {

    private final List<GridSegment> segments;

    public static GridSegmentPath empty() {
        return new GridSegmentPath(List.of());
    }

    public static GridSegmentPath of(List<GridSegment> segments) {
        return new GridSegmentPath(segments);
    }

    public static GridSegmentPath concat(GridSegmentPath... paths) {
        if (paths == null || paths.length == 0) {
            return empty();
        }
        ArrayList<GridSegment> result = new ArrayList<>();
        for (GridSegmentPath path : paths) {
            if (path == null || path.isEmpty()) {
                continue;
            }
            result.addAll(path.segments());
        }
        return result.isEmpty() ? empty() : new GridSegmentPath(result);
    }

    private GridSegmentPath(List<GridSegment> segments) {
        this.segments = normalizeSegments(segments);
    }

    public List<GridSegment> segments() {
        return segments;
    }

    public boolean isEmpty() {
        return segments.isEmpty();
    }

    @Override
    public GridSegmentPath translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new GridSegmentPath(segments.stream()
                .map(segment -> segment.translated(resolvedTranslation))
                .toList());
    }

    @Override
    public Set<Integer> levels() {
        if (segments.isEmpty()) {
            return Set.of();
        }
        return Set.of(segments.getFirst().start().z());
    }

    @Override
    public GridArea cellFootprint() {
        if (segments.isEmpty()) {
            return GridArea.empty();
        }
        LinkedHashSet<GridPoint> cells = new LinkedHashSet<>();
        for (GridSegment segment : segments) {
            cells.addAll(segment.cellFootprint().cells());
        }
        return cells.isEmpty() ? GridArea.empty() : GridArea.of(cells);
    }

    @Override
    public GridBoundary boundary() {
        return segments.isEmpty() ? GridBoundary.empty() : GridBoundary.of(segments);
    }

    private static List<GridSegment> normalizeSegments(List<GridSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        ArrayList<GridSegment> result = new ArrayList<>();
        Integer levelZ = null;
        GridSegment previous = null;
        for (GridSegment segment : segments) {
            if (segment == null) {
                continue;
            }
            int segmentLevelZ = segment.start().z();
            if (levelZ == null) {
                levelZ = segmentLevelZ;
            } else if (levelZ != segmentLevelZ) {
                throw new IllegalArgumentException("GridSegmentPath segments must lie on the same level");
            }
            if (previous != null && previous.sharedEndpoint(segment).isEmpty()) {
                throw new IllegalArgumentException("GridSegmentPath segments must form a continuous route");
            }
            result.add(segment);
            previous = segment;
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridSegmentPath that)) {
            return false;
        }
        return Objects.equals(segments, that.segments);
    }

    @Override
    public int hashCode() {
        return Objects.hash(segments);
    }

    @Override
    public String toString() {
        return "GridSegmentPath[segments=" + segments + "]";
    }
}
