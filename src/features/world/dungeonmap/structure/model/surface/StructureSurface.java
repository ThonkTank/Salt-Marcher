package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridArea;
import features.world.dungeonmap.geometry.GridTranslation;
import features.world.dungeonmap.structure.model.StructureMutation;

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
                GridPoint anchorCell,
                Collection<GridPoint> surfaceCells,
                Collection<GridPoint> floorCells
        ) {
            return new PersistenceSnapshot(
                    new StructureSurfaceArea.PersistenceSnapshot(anchorCell, normalizedCells(surfaceCells)),
                    new StructureFloor.PersistenceSnapshot(normalizedCells(floorCells)));
        }

        public GridPoint anchorCell() {
            return surface.anchorCell();
        }

        public Set<GridPoint> surfaceCells() {
            return surface.cells();
        }

        public Set<GridPoint> floorCells() {
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
            return Objects.equals(surface, that.surface) && Objects.equals(floor, that.floor);
        }

        @Override
        public int hashCode() {
            return Objects.hash(surface, floor);
        }

        @Override
        public String toString() {
            return "PersistenceSnapshot[surface=" + surface + ", floor=" + floor + "]";
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
            GridPoint anchorCell,
            Collection<GridPoint> surfaceCells,
            Collection<GridPoint> floorCells
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

    public static StructureSurface fromSurfaceAndFloor(StructureSurfaceArea surface, StructureFloor floor) {
        StructureSurfaceArea resolvedSurface = surface == null ? StructureSurfaceArea.empty() : surface;
        return resolvedSurface.isEmpty() ? empty() : new StructureSurface(resolvedSurface, floor);
    }

    private StructureSurface(StructureSurfaceArea surface, StructureFloor floor) {
        this.surface = surface == null ? StructureSurfaceArea.empty() : surface;
        this.floor = this.surface.isEmpty()
                ? StructureFloor.empty()
                : StructureFloor.fromCells(floor == null ? null : floor.cells(), this.surface);
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

    public GridPoint center() {
        GridPoint floorCenter = floor.center();
        return floorCenter != null ? floorCenter : surface.center();
    }

    public StructureSurface translated(GridTranslation translation) {
        return fromSurfaceAndFloor(surface.translated(translation), floor.translated(translation));
    }

    public StructureSurface editedSurfaceCells(
            Collection<GridPoint> cells,
            StructureMutation.CellEditMode mode,
            StructureMutation.FloorSyncPolicy floorSyncPolicy,
            GridPoint preferredAnchorCell
    ) {
        Set<GridPoint> nextSurfaceCells = editedCells(surface.cells(), cells, mode);
        if (Objects.equals(nextSurfaceCells, surface.cells())) {
            return this;
        }
        if (nextSurfaceCells.isEmpty()) {
            return empty();
        }
        Set<GridPoint> nextFloorCells = floorSyncPolicy == StructureMutation.FloorSyncPolicy.MATCH_SURFACE_EDIT
                ? editedCells(floor.cells(), cells, mode)
                : floor.cells();
        return fromCells(
                preferredAnchorCell(surface.anchorCell(), preferredAnchorCell, nextSurfaceCells),
                nextSurfaceCells,
                nextFloorCells);
    }

    public StructureSurface editedFloorCells(Collection<GridPoint> cells, StructureMutation.CellEditMode mode) {
        Set<GridPoint> nextFloorCells = editedCells(floor.cells(), cells, mode);
        if (Objects.equals(nextFloorCells, floor.cells())) {
            return this;
        }
        return fromCells(surface.anchorCell(), surface.cells(), nextFloorCells);
    }

    public StructureSurface clippedTo(Collection<GridPoint> clippedSurfaceCells, GridPoint preferredAnchor) {
        StructureSurfaceArea clippedSurface = surface.clippedTo(clippedSurfaceCells, preferredAnchor);
        return clippedSurface.isEmpty() ? empty() : fromSurfaceAndFloor(clippedSurface, floor.clippedTo(clippedSurface));
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
        return Objects.equals(surface, that.surface) && Objects.equals(floor, that.floor);
    }

    @Override
    public int hashCode() {
        return Objects.hash(surface, floor);
    }

    @Override
    public String toString() {
        return "StructureSurface[surface=" + surface + ", floor=" + floor + "]";
    }

    private static Set<GridPoint> editedCells(
            Collection<GridPoint> existingCells,
            Collection<GridPoint> editedCells,
            StructureMutation.CellEditMode mode
    ) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>(normalizedCells(existingCells));
        Set<GridPoint> normalizedEditedCells = normalizedCells(editedCells);
        if (normalizedEditedCells.isEmpty()) {
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
        if (mode == StructureMutation.CellEditMode.ADD) {
            result.addAll(normalizedEditedCells);
        } else {
            result.removeAll(normalizedEditedCells);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static GridPoint preferredAnchorCell(
            GridPoint currentAnchorCell,
            GridPoint preferredAnchorCell,
            Set<GridPoint> surfaceCells
    ) {
        if (preferredAnchorCell != null && surfaceCells.contains(preferredAnchorCell)) {
            return preferredAnchorCell;
        }
        if (currentAnchorCell != null && surfaceCells.contains(currentAnchorCell)) {
            return currentAnchorCell;
        }
        return surfaceCells.isEmpty() ? null : GridArea.of(surfaceCells).center();
    }

    private static Set<GridPoint> normalizedCells(Collection<GridPoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : cells) {
            if (cell != null && cell.kind() == GridPoint.Kind.CELL) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
