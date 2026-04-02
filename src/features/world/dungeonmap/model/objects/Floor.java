package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileFaceShape;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A floor owns its walkable cells directly; TileFaceShape is now only a derived compatibility surface.
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

    public TileFaceShape shape2x() {
        return new TileFaceShape(cells());
    }

    public Point2i anchorCell() {
        return anchorCell.toPoint2i();
    }

    public Set<Point2i> cells() {
        return CellCoord.toPoints(cellCoords);
    }

    public CellCoord centerCellCoord() {
        return cellCoords.isEmpty() ? null : StructureDescriptor.bestCenterCoord(cellCoords);
    }

    public Point2i centerCell() {
        CellCoord center = centerCellCoord();
        return center == null ? null : center.toPoint2i();
    }

    public boolean contains(CellCoord cell) {
        return cell != null && cellCoords.contains(cell);
    }

    public boolean contains(Point2i cell) {
        return contains(cell == null ? null : CellCoord.fromPoint(cell));
    }

    public Floor movedBy(Point2i delta) {
        return movedBy(CellCoord.fromPoint(delta));
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
        return new Floor(translated, anchorCell.add(resolvedDelta));
    }

    private static Set<CellCoord> normalizeCells(Collection<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        cells.stream()
                .filter(cell -> cell != null)
                .sorted(CellCoord.ORDER)
                .forEach(result::add);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CellCoord normalizeAnchor(CellCoord anchorCell, Set<CellCoord> cellCoords) {
        if (anchorCell != null) {
            return anchorCell;
        }
        if (cellCoords == null || cellCoords.isEmpty()) {
            return new CellCoord(0, 0);
        }
        return StructureDescriptor.bestCenterCoord(cellCoords);
    }
}
