package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical public structure mutation vocabulary.
 *
 * <p>Callers may vary in semantics, but they must normalize the physical change down to one of these requests before
 * mutating a {@link Structure}.</p>
 */
public sealed interface StructureMutation permits
        StructureMutation.SurfaceCellsEdit,
        StructureMutation.FloorCellsEdit,
        StructureMutation.WallPathEdit,
        StructureMutation.DoorSegmentsEdit,
        StructureMutation.DoorMove,
        StructureMutation.Translation {

    enum CellEditMode {
        ADD,
        REMOVE
    }

    enum BoundaryEditMode {
        CREATE,
        DELETE
    }

    enum FloorSyncPolicy {
        MATCH_SURFACE_EDIT,
        KEEP_EXISTING_CLIPPED
    }

    record SurfaceCellsEdit(
            int levelZ,
            Set<CellCoord> cells,
            CellEditMode mode,
            FloorSyncPolicy floorSyncPolicy,
            CellCoord preferredAnchorCell
    ) implements StructureMutation {
        public SurfaceCellsEdit {
            cells = normalizedCells(cells);
            mode = Objects.requireNonNull(mode, "mode");
            floorSyncPolicy = Objects.requireNonNull(floorSyncPolicy, "floorSyncPolicy");
        }
    }

    record FloorCellsEdit(
            int levelZ,
            Set<CellCoord> cells,
            CellEditMode mode
    ) implements StructureMutation {
        public FloorCellsEdit {
            cells = normalizedCells(cells);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record WallPathEdit(
            int levelZ,
            List<GridSegment2x> segments2x,
            BoundaryEditMode mode
    ) implements StructureMutation {
        public WallPathEdit {
            segments2x = normalizedSegments(segments2x);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorSegmentsEdit(
            int levelZ,
            List<GridSegment2x> segments2x,
            BoundaryEditMode mode
    ) implements StructureMutation {
        public DoorSegmentsEdit {
            segments2x = normalizedSegments(segments2x);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorMove(
            int levelZ,
            GridSegment2x sourceBoundarySegment2x,
            GridSegment2x targetBoundarySegment2x
    ) implements StructureMutation {
        public DoorMove {
            Objects.requireNonNull(sourceBoundarySegment2x, "sourceBoundarySegment2x");
            Objects.requireNonNull(targetBoundarySegment2x, "targetBoundarySegment2x");
        }
    }

    record Translation(
            CellCoord delta,
            int levelDelta
    ) implements StructureMutation {
        public Translation {
            delta = delta == null ? new CellCoord(0, 0) : delta;
        }
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

    private static List<GridSegment2x> normalizedSegments(Collection<GridSegment2x> segments2x) {
        if (segments2x == null || segments2x.isEmpty()) {
            return List.of();
        }
        return segments2x.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted(GridSegment2x.ORDER)
                .toList();
    }
}
