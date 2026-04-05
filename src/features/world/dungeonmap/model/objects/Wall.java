package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

public final class Wall extends EdgeShape {

    private final List<GridSegment2x> segments2x;

    // A wall is just a normalized 2x boundary path whose domain rule is that passage is always blocked.
    public Wall(Collection<GridSegment2x> segments) {
        super(normalizeBoundarySegments(segments));
        this.segments2x = normalizeBoundarySegments(segments);
    }

    public static Wall fromSegments(Collection<GridSegment2x> segments) {
        return new Wall(segments);
    }

    public List<GridSegment2x> segments2x() {
        return segments2x;
    }

    public Wall movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
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

    private static List<GridSegment2x> normalizeBoundarySegments(Collection<GridSegment2x> segments) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment : GridSegment2x.boundarySteps(segments).stream()
                .sorted(GridSegment2x.ORDER)
                .toList()) {
            if (!segment.isBoundaryEdge()) {
                throw new IllegalArgumentException("Wall segments must be boundary edges");
            }
            result.add(segment);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
