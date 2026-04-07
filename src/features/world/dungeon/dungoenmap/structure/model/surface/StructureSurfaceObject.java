package features.world.dungeon.dungoenmap.structure.model.surface;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridTranslation;

import java.util.Set;

/**
 * Internal shared area-backed base for surface child owners.
 */
abstract sealed class StructureSurfaceObject permits StructureSurfaceArea, StructureFloor {

    private final GridArea area;

    StructureSurfaceObject(GridArea area) {
        this.area = area == null ? GridArea.empty() : area;
    }

    public final Set<GridPoint> cells() {
        return area.cells();
    }

    public final boolean contains(GridPoint cell) {
        return cell != null && area.contains(cell);
    }

    public final GridPoint center() {
        return area.center();
    }

    public final boolean isEmpty() {
        return area.isEmpty();
    }

    final GridArea area() {
        return area;
    }

    final GridArea translatedArea(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero() ? area : area.translated(resolvedTranslation);
    }

    final GridArea intersectedArea(GridArea cells) {
        return area.intersection(cells == null ? GridArea.empty() : cells);
    }

    final GridTranslation resolvedTranslation(GridTranslation translation) {
        return translation == null ? GridTranslation.none() : translation;
    }
}
