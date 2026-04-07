package features.world.dungeonmap.map.structure.model.surface;

import features.world.dungeonmap.geometry.GridArea;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridTranslation;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical owner for traversable floor cells constrained to one surface area.
 */
public final class StructureFloor extends StructureSurfaceObject {

    record PersistenceSnapshot(Set<GridPoint> cells) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    static StructureFloor empty() {
        return new StructureFloor(GridArea.empty());
    }

    static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(Set.of());
    }

    static StructureFloor fromCells(Collection<GridPoint> cells, StructureSurfaceArea surfaceArea) {
        StructureSurfaceArea resolvedSurfaceArea = surfaceArea == null ? StructureSurfaceArea.empty() : surfaceArea;
        return resolvedSurfaceArea.isEmpty()
                ? empty()
                : new StructureFloor(resolvedSurfaceArea.area().intersection(GridArea.of(cells)));
    }

    private StructureFloor(GridArea area) {
        super(area);
    }

    StructureFloor translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = resolvedTranslation(translation);
        return resolvedTranslation.isZero() ? this : new StructureFloor(translatedArea(resolvedTranslation));
    }

    StructureFloor clippedTo(StructureSurfaceArea surfaceArea) {
        return fromCells(cells(), surfaceArea);
    }

    PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(cells());
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureFloor that)) {
            return false;
        }
        return Objects.equals(cells(), that.cells());
    }

    @Override
    public int hashCode() {
        return Objects.hash(cells());
    }

    @Override
    public String toString() {
        return "StructureFloor[cells=" + cells() + "]";
    }
}
