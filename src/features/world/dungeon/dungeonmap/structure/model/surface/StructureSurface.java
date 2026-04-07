package features.world.dungeon.dungeonmap.structure.model.surface;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungeonmap.structure.model.StructureMutation;

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
                GridArea surfaceArea,
                GridArea floorArea
        ) {
            return new PersistenceSnapshot(
                    new StructureSurfaceArea.PersistenceSnapshot(anchorCell, normalizedCells(surfaceArea)),
                    new StructureFloor.PersistenceSnapshot(normalizedCells(floorArea)));
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
            GridArea surfaceArea,
            GridArea floorArea
    ) {
        StructureSurfaceArea surface = StructureSurfaceArea.fromCells(anchorCell, surfaceArea);
        return fromSurfaceAndFloor(surface, StructureFloor.fromCells(floorArea, surface));
    }

    public static StructureSurface fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        StructureSurfaceArea surface = StructureSurfaceArea.fromCells(
                resolvedSnapshot.anchorCell(),
                GridArea.of(resolvedSnapshot.surfaceCells()));
        return fromSurfaceAndFloor(surface, StructureFloor.fromCells(GridArea.of(resolvedSnapshot.floorCells()), surface));
    }

    public static StructureSurface fromSurfaceAndFloor(StructureSurfaceArea surface, StructureFloor floor) {
        StructureSurfaceArea resolvedSurface = surface == null ? StructureSurfaceArea.empty() : surface;
        return resolvedSurface.isEmpty() ? empty() : new StructureSurface(resolvedSurface, floor);
    }

    private StructureSurface(StructureSurfaceArea surface, StructureFloor floor) {
        this.surface = surface == null ? StructureSurfaceArea.empty() : surface;
        this.floor = this.surface.isEmpty()
                ? StructureFloor.empty()
                : StructureFloor.fromCells(floor == null ? GridArea.empty() : GridArea.of(floor.cells()), this.surface);
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
            GridArea cells,
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
        StructureSurfaceArea nextSurface = StructureSurfaceArea.fromCells(
                GridArea.of(nextSurfaceCells),
                surface.anchorCell(),
                preferredAnchorCell);
        return fromSurfaceAndFloor(nextSurface, StructureFloor.fromCells(GridArea.of(nextFloorCells), nextSurface));
    }

    public StructureSurface editedFloorCells(GridArea cells, StructureMutation.CellEditMode mode) {
        Set<GridPoint> nextFloorCells = editedCells(floor.cells(), cells, mode);
        if (Objects.equals(nextFloorCells, floor.cells())) {
            return this;
        }
        return fromCells(surface.anchorCell(), GridArea.of(surface.cells()), GridArea.of(nextFloorCells));
    }

    public StructureSurface clippedTo(GridArea clippedSurfaceCells, GridPoint preferredAnchor) {
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
            Set<GridPoint> existingCells,
            GridArea editedCells,
            StructureMutation.CellEditMode mode
    ) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>(existingCells == null ? Set.<GridPoint>of() : existingCells);
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

    private static Set<GridPoint> normalizedCells(GridArea area) {
        if (area == null || area.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : area.cells()) {
            if (cell != null && cell.kind() == GridPoint.Kind.CELL) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
