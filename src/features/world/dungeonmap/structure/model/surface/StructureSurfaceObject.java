package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collection;
import java.util.Set;

/**
 * Internal shared tile-shape base for surface child owners.
 */
abstract sealed class StructureSurfaceObject permits StructureSurfaceArea, StructureFloor {

    private final TileShape tileShape;

    StructureSurfaceObject(TileShape tileShape) {
        this.tileShape = tileShape == null ? TileShape.empty() : tileShape;
    }

    public final Set<CellCoord> cellCoords() {
        return tileShape.cellCoords();
    }

    public final boolean contains(CellCoord cell) {
        return cell != null && tileShape.contains(cell);
    }

    public final CellCoord centerCellCoord() {
        return tileShape.isEmpty() ? null : tileShape.centerCellCoord();
    }

    public final boolean isEmpty() {
        return tileShape.isEmpty();
    }

    final TileShape tileShape() {
        return tileShape;
    }

    final TileShape translatedTileShape(CellCoord delta) {
        CellCoord resolvedDelta = resolvedDelta(delta);
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return tileShape;
        }
        return tileShape.translatedByCells(resolvedDelta);
    }

    final TileShape intersectedTileShape(Collection<CellCoord> cells) {
        return tileShape.intersection(cells);
    }

    final CellCoord resolvedDelta(CellCoord delta) {
        return delta == null ? new CellCoord(0, 0) : delta;
    }
}
