package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.geometry.GridArea;
import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.geometry.GridTranslation;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical owner for anchor and occupied surface cells on one structure level.
 */
public final class StructureSurfaceArea extends StructureSurfaceObject {

    record PersistenceSnapshot(
            GridPoint anchorCell,
            Set<GridPoint> cells
    ) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    private final GridPoint anchorCell;

    static StructureSurfaceArea empty() {
        return new StructureSurfaceArea(null, GridArea.empty());
    }

    static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(null, Set.of());
    }

    static StructureSurfaceArea fromCells(GridPoint anchorCell, Collection<GridPoint> cells) {
        GridArea area = GridArea.of(cells);
        return area.isEmpty() ? empty() : new StructureSurfaceArea(anchorCell, area);
    }

    private StructureSurfaceArea(GridPoint anchorCell, GridArea area) {
        super(area);
        this.anchorCell = normalizeAnchor(anchorCell, area());
    }

    public GridPoint anchorCell() {
        return anchorCell;
    }

    public Set<GridPoint> reachableFrom(GridPoint startCell, Collection<GridSegment> boundaryEdges) {
        if (startCell == null || !contains(startCell)) {
            return Set.of();
        }
        GridBoundary barriers = boundaryEdges == null ? GridBoundary.empty() : GridBoundary.of(boundaryEdges);
        return area().reachableFrom(startCell, barriers).cells();
    }

    StructureSurfaceArea translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = resolvedTranslation(translation);
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new StructureSurfaceArea(
                anchorCell == null ? null : anchorCell.translated(resolvedTranslation),
                translatedArea(resolvedTranslation));
    }

    StructureSurfaceArea clippedTo(Collection<GridPoint> clippedCells, GridPoint preferredAnchor) {
        GridArea clippedArea = intersectedArea(clippedCells);
        if (clippedArea.isEmpty()) {
            return empty();
        }
        Set<GridPoint> clippedSurfaceCells = clippedArea.cells();
        return fromCells(
                preferredAnchor != null && clippedSurfaceCells.contains(preferredAnchor)
                        ? preferredAnchor
                        : clippedArea.center(),
                clippedSurfaceCells);
    }

    PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(anchorCell, cells());
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureSurfaceArea that)) {
            return false;
        }
        return Objects.equals(anchorCell, that.anchorCell)
                && Objects.equals(cells(), that.cells());
    }

    @Override
    public int hashCode() {
        return Objects.hash(anchorCell, cells());
    }

    @Override
    public String toString() {
        return "StructureSurfaceArea[anchorCell=" + anchorCell + ", cells=" + cells() + "]";
    }

    private static GridPoint normalizeAnchor(GridPoint anchorCell, GridArea area) {
        if (area == null || area.isEmpty()) {
            return anchorCell;
        }
        if (anchorCell != null && area.contains(anchorCell)) {
            return anchorCell;
        }
        GridPoint center = area.center();
        return center == null ? null : center;
    }
}
