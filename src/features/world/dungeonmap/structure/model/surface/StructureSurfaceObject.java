package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridArea;

import java.util.Collection;
import java.util.Set;

/**
 * Internal shared tile-shape base for surface child owners.
 */
abstract sealed class StructureSurfaceObject permits StructureSurfaceArea, StructureFloor {

    private final GridArea tileShape;

    StructureSurfaceObject(GridArea tileShape) {
        this.tileShape = tileShape == null ? GridArea.empty() : tileShape;
    }

    public final Set<GridPoint> cellCoords() {
        return tileShape.cellCoords();
    }

    public final boolean contains(GridPoint cell) {
        return cell != null && tileShape.contains(cell);
    }

    public final GridPoint centerGridPoint() {
        return tileShape.isEmpty() ? null : tileShape.centerGridPoint();
    }

    public final boolean isEmpty() {
        return tileShape.isEmpty();
    }

    final GridArea tileShape() {
        return tileShape;
    }

    final GridArea translatedGridArea(GridPoint delta) {
        GridPoint resolvedDelta = resolvedDelta(delta);
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return tileShape;
        }
        return tileShape.translatedByCells(resolvedDelta);
    }

    final GridArea intersectedGridArea(Collection<GridPoint> cells) {
        return tileShape.intersection(cells);
    }

    final GridPoint resolvedDelta(GridPoint delta) {
        return delta == null ? new GridPoint(0, 0) : delta;
    }
}
