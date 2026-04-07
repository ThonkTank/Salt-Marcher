package features.world.dungeon.dungoenmap.structure.model;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;

import java.util.Objects;

/**
 * Canonical public structure mutation vocabulary.
 *
 * <p>Callers may vary in workflow semantics, but they must reduce the physical change to one of these requests before
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
            GridArea cells,
            CellEditMode mode,
            FloorSyncPolicy floorSyncPolicy,
            GridPoint preferredAnchorCell
    ) implements StructureMutation {
        public SurfaceCellsEdit {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
            mode = Objects.requireNonNull(mode, "mode");
            floorSyncPolicy = Objects.requireNonNull(floorSyncPolicy, "floorSyncPolicy");
        }
    }

    record FloorCellsEdit(
            int levelZ,
            GridArea cells,
            CellEditMode mode
    ) implements StructureMutation {
        public FloorCellsEdit {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record WallPathEdit(
            int levelZ,
            GridBoundary segments,
            BoundaryEditMode mode
    ) implements StructureMutation {
        public WallPathEdit {
            segments = segments == null ? GridBoundary.empty() : segments;
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorSegmentsEdit(
            int levelZ,
            GridBoundary segments,
            BoundaryEditMode mode
    ) implements StructureMutation {
        public DoorSegmentsEdit {
            segments = segments == null ? GridBoundary.empty() : segments;
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorMove(
            int levelZ,
            GridSegment sourceBoundarySegment,
            GridSegment targetBoundarySegment
    ) implements StructureMutation {
        public DoorMove {
            Objects.requireNonNull(sourceBoundarySegment, "sourceBoundarySegment");
            Objects.requireNonNull(targetBoundarySegment, "targetBoundarySegment");
        }
    }

    record Translation(GridTranslation translation) implements StructureMutation {
        public Translation {
            translation = translation == null ? GridTranslation.none() : translation;
        }
    }
}
