package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.model.geometry.CellCoord;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical level-local aggregate over the surface and floor objects attached to one structure level.
 */
public final class StructureSurface {

    public static final class PersistenceSnapshot {

        private final StructureSurfaceArea.PersistenceSnapshot surface;
        private final StructureFloor.PersistenceSnapshot floor;

        private PersistenceSnapshot(
                StructureSurfaceArea.PersistenceSnapshot surface,
                StructureFloor.PersistenceSnapshot floor
        ) {
            this.surface = surface == null ? StructureSurfaceArea.emptySnapshot() : surface;
            this.floor = floor == null ? StructureFloor.emptySnapshot() : floor;
        }

        public static PersistenceSnapshot empty() {
            return new PersistenceSnapshot(StructureSurfaceArea.emptySnapshot(), StructureFloor.emptySnapshot());
        }

        public static PersistenceSnapshot fromCells(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<CellCoord> floorCells
        ) {
            return new PersistenceSnapshot(
                    new StructureSurfaceArea.PersistenceSnapshot(anchorCell, normalizedCells(surfaceCells)),
                    new StructureFloor.PersistenceSnapshot(normalizedCells(floorCells)));
        }

        public CellCoord anchorCell() {
            return surface.anchorCell();
        }

        public Set<CellCoord> surfaceCells() {
            return surface.cells();
        }

        public Set<CellCoord> floorCells() {
            return floor.cells();
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof PersistenceSnapshot that)) {
                return false;
            }
            return Objects.equals(surface, that.surface)
                    && Objects.equals(floor, that.floor);
        }

        @Override
        public int hashCode() {
            return Objects.hash(surface, floor);
        }

        @Override
        public String toString() {
            return "PersistenceSnapshot[surface=" + surface
                    + ", floor=" + floor + "]";
        }
    }

    private final StructureSurfaceArea surface;
    private final StructureFloor floor;

    public static StructureSurface empty() {
        return new StructureSurface(StructureSurfaceArea.empty(), StructureFloor.empty());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return PersistenceSnapshot.empty();
    }

    public static StructureSurface fromCells(
            CellCoord anchorCell,
            Collection<CellCoord> surfaceCells,
            Collection<CellCoord> floorCells
    ) {
        StructureSurfaceArea surface = StructureSurfaceArea.fromCells(anchorCell, surfaceCells);
        return fromSurfaceAndFloor(surface, StructureFloor.fromCells(floorCells, surface));
    }

    public static StructureSurface fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        StructureSurfaceArea surface = StructureSurfaceArea.fromCells(
                resolvedSnapshot.anchorCell(),
                resolvedSnapshot.surfaceCells());
        return fromSurfaceAndFloor(surface, StructureFloor.fromCells(resolvedSnapshot.floorCells(), surface));
    }

    public static StructureSurface fromSurfaceAndFloor(
            StructureSurfaceArea surface,
            StructureFloor floor
    ) {
        StructureSurfaceArea resolvedSurface = surface == null ? StructureSurfaceArea.empty() : surface;
        if (resolvedSurface.isEmpty()) {
            return empty();
        }
        return new StructureSurface(resolvedSurface, floor);
    }

    private StructureSurface(
            StructureSurfaceArea surface,
            StructureFloor floor
    ) {
        this.surface = surface == null ? StructureSurfaceArea.empty() : surface;
        this.floor = this.surface.isEmpty()
                ? StructureFloor.empty()
                : StructureFloor.fromCells(floor == null ? null : floor.cellCoords(), this.surface);
    }

    public StructureSurfaceArea surface() {
        return surface;
    }

    public StructureFloor floor() {
        return floor;
    }

    public PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(surface.persistenceSnapshot(), floor.persistenceSnapshot());
    }

    public CellCoord centerCellCoord() {
        CellCoord floorCenter = floor.centerCellCoord();
        return floorCenter != null ? floorCenter : surface.centerCellCoord();
    }

    public StructureSurface withSurface(StructureSurfaceArea surface) {
        return fromSurfaceAndFloor(surface, floor);
    }

    public StructureSurface withFloor(StructureFloor floor) {
        return fromSurfaceAndFloor(surface, floor);
    }

    public StructureSurface translatedByCells(CellCoord delta) {
        return fromSurfaceAndFloor(surface.translatedByCells(delta), floor.translatedByCells(delta));
    }

    public StructureSurface clippedTo(Collection<CellCoord> clippedSurfaceCells, CellCoord preferredAnchor) {
        StructureSurfaceArea clippedSurface = surface.clippedTo(clippedSurfaceCells, preferredAnchor);
        if (clippedSurface.isEmpty()) {
            return empty();
        }
        return fromSurfaceAndFloor(clippedSurface, floor.clippedTo(clippedSurface));
    }

    public boolean isEmpty() {
        return surface.isEmpty() && floor.isEmpty();
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureSurface that)) {
            return false;
        }
        return Objects.equals(surface, that.surface)
                && Objects.equals(floor, that.floor);
    }

    @Override
    public int hashCode() {
        return Objects.hash(surface, floor);
    }

    @Override
    public String toString() {
        return "StructureSurface[surface=" + surface
                + ", floor=" + floor + "]";
    }

    private static Set<CellCoord> normalizedCells(Collection<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CellCoord cell : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
