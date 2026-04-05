package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collection;
import java.util.Set;

/**
 * A floor owns its walkable cells directly.
 */
public final class Floor extends TileShape {

    private final CellCoord anchorCell;

    public static Floor empty() {
        return new Floor(Set.of(), null);
    }

    public Floor(Collection<CellCoord> cellCoords, CellCoord anchorCell) {
        super(cellCoords);
        this.anchorCell = normalizeAnchor(anchorCell, cellCoords());
    }

    public CellCoord anchorCellCoord() {
        return anchorCell;
    }

    public Floor movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Floor(
                cellCoords().stream()
                        .map(cell -> cell.add(resolvedDelta))
                        .toList(),
                anchorCell == null ? null : anchorCell.add(resolvedDelta));
    }

    private static CellCoord normalizeAnchor(CellCoord anchorCell, Set<CellCoord> cellCoords) {
        if (anchorCell != null) {
            return anchorCell;
        }
        if (cellCoords == null || cellCoords.isEmpty()) {
            return new CellCoord(0, 0);
        }
        return CellCoord.bestCenter(cellCoords);
    }
}
