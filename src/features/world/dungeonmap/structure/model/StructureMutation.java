package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;

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
            Set<GridPoint> cells,
            CellEditMode mode,
            FloorSyncPolicy floorSyncPolicy,
            GridPoint preferredAnchorCell
    ) implements StructureMutation {
        public SurfaceCellsEdit {
            cells = normalizedCells(cells);
            mode = Objects.requireNonNull(mode, "mode");
            floorSyncPolicy = Objects.requireNonNull(floorSyncPolicy, "floorSyncPolicy");
        }
    }

    record FloorCellsEdit(
            int levelZ,
            Set<GridPoint> cells,
            CellEditMode mode
    ) implements StructureMutation {
        public FloorCellsEdit {
            cells = normalizedCells(cells);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record WallPathEdit(
            int levelZ,
            List<GridSegment> segments2x,
            BoundaryEditMode mode
    ) implements StructureMutation {
        public WallPathEdit {
            segments2x = normalizedSegments(segments2x);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorSegmentsEdit(
            int levelZ,
            List<GridSegment> segments2x,
            BoundaryEditMode mode
    ) implements StructureMutation {
        public DoorSegmentsEdit {
            segments2x = normalizedSegments(segments2x);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorMove(
            int levelZ,
            GridSegment sourceBoundarySegment2x,
            GridSegment targetBoundarySegment2x
    ) implements StructureMutation {
        public DoorMove {
            Objects.requireNonNull(sourceBoundarySegment2x, "sourceBoundarySegment2x");
            Objects.requireNonNull(targetBoundarySegment2x, "targetBoundarySegment2x");
        }
    }

    record Translation(
            GridPoint delta,
            int levelDelta
    ) implements StructureMutation {
        public Translation {
            delta = delta == null ? new GridPoint(0, 0) : delta;
        }
    }

    private static Set<GridPoint> normalizedCells(Collection<GridPoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<GridSegment> normalizedSegments(Collection<GridSegment> segments2x) {
        if (segments2x == null || segments2x.isEmpty()) {
            return List.of();
        }
        return segments2x.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted(GridSegment.ORDER)
                .toList();
    }
}
