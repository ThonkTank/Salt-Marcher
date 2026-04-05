package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;

public final class Wall extends EdgeShape {

    // A wall is just a normalized 2x boundary path whose domain rule is that passage is always blocked.
    public Wall(Collection<GridSegment2x> segments) {
        super(EdgeShape.normalizeBoundarySegments(segments));
    }

    public static Wall fromSegments(Collection<GridSegment2x> segments) {
        return new Wall(segments);
    }

    public Wall movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Wall(segments2x().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList());
    }

    public boolean blocksPassage() {
        return true;
    }
}
