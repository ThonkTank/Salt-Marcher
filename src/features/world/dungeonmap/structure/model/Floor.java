package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collection;
import java.util.Set;

/**
 * A floor is the walkable cell subset of a structure surface.
 */
public final class Floor extends TileShape {

    public static Floor empty() {
        return new Floor(Set.of());
    }

    public Floor(Collection<CellCoord> cellCoords) {
        super(cellCoords);
    }

    public Floor(TileShape shape) {
        super(shape);
    }

    public Floor movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Floor(
                cellCoords().stream()
                        .map(cell -> cell.add(resolvedDelta))
                        .toList());
    }
}
