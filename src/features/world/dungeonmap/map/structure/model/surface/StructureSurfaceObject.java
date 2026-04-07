package features.world.dungeonmap.map.structure.model.surface;

import features.world.dungeonmap.geometry.GridArea;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridTranslation;

import java.util.Collection;
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

    final GridArea intersectedArea(Collection<GridPoint> cells) {
        return area.intersection(GridArea.of(cells));
    }

    final GridTranslation resolvedTranslation(GridTranslation translation) {
        return translation == null ? GridTranslation.none() : translation;
    }
}
