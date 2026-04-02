package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A floor owns its walkable cells directly.
 */
public final class Floor {

    private final Set<CellCoord> cellCoords;
    private final CellCoord anchorCell;

    public static Floor empty() {
        return new Floor(Set.of(), null);
    }

    public Floor(Collection<CellCoord> cellCoords, CellCoord anchorCell) {
        Set<CellCoord> resolvedCells = normalizeCells(cellCoords);
        this.cellCoords = resolvedCells;
        this.anchorCell = normalizeAnchor(anchorCell, resolvedCells);
    }

    public Set<CellCoord> cellCoords() {
        return cellCoords;
    }

    public CellCoord anchorCellCoord() {
        return anchorCell;
    }

    public CellCoord centerCellCoord() {
        return cellCoords.isEmpty() ? null : CellCoord.bestCenter(cellCoords);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && cellCoords.contains(cell);
    }

    public Floor movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        LinkedHashSet<CellCoord> translated = new LinkedHashSet<>();
        for (CellCoord cell : cellCoords) {
            translated.add(cell.add(resolvedDelta));
        }
        return new Floor(translated, anchorCell == null ? null : anchorCell.add(resolvedDelta));
    }

    private static Set<CellCoord> normalizeCells(Collection<CellCoord> cells) {
        return CellCoord.normalize(cells);
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
