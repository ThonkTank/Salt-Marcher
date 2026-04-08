package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;

import java.util.Objects;

/**
 * Canonical public cluster mutation request vocabulary.
 */
public sealed interface ClusterMutationRequest permits
        ClusterMutationRequest.Translation,
        ClusterMutationRequest.FloorCellsEdit,
        ClusterMutationRequest.WallPathEdit,
        ClusterMutationRequest.DoorSegmentsEdit,
        ClusterMutationRequest.DoorMove {

    enum CellEditMode {
        ADD,
        REMOVE
    }

    enum BoundaryEditMode {
        CREATE,
        DELETE
    }

    enum DoorScope {
        INTERIOR,
        EXTERIOR
    }

    record Translation(GridTranslation translation) implements ClusterMutationRequest {
        public Translation {
            translation = translation == null ? GridTranslation.none() : translation;
        }
    }

    record FloorCellsEdit(
            int levelZ,
            GridArea cells,
            CellEditMode mode
    ) implements ClusterMutationRequest {
        public FloorCellsEdit {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record WallPathEdit(
            int levelZ,
            GridBoundary segments,
            BoundaryEditMode mode
    ) implements ClusterMutationRequest {
        public WallPathEdit {
            segments = segments == null ? GridBoundary.empty() : segments;
            mode = Objects.requireNonNull(mode, "mode");
        }
    }

    record DoorSegmentsEdit(
            int levelZ,
            GridBoundary segments,
            BoundaryEditMode mode,
            DoorScope scope
    ) implements ClusterMutationRequest {
        public DoorSegmentsEdit {
            segments = segments == null ? GridBoundary.empty() : segments;
            mode = Objects.requireNonNull(mode, "mode");
            scope = Objects.requireNonNull(scope, "scope");
        }
    }

    record DoorMove(
            int levelZ,
            GridSegment sourceBoundarySegment,
            GridSegment targetBoundarySegment
    ) implements ClusterMutationRequest {
        public DoorMove {
            Objects.requireNonNull(sourceBoundarySegment, "sourceBoundarySegment");
            Objects.requireNonNull(targetBoundarySegment, "targetBoundarySegment");
        }
    }
}
