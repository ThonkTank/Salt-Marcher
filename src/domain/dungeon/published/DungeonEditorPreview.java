package src.domain.dungeon.published;

import java.util.List;

public sealed interface DungeonEditorPreview permits DungeonEditorPreview.NonePreview,
        DungeonEditorPreview.RoomRectanglePreview,
        DungeonEditorPreview.ClusterBoundariesPreview,
        DungeonEditorPreview.StairCreatePreview,
        DungeonEditorPreview.MoveHandlePreview,
        DungeonEditorPreview.MoveBoundaryStretchPreview {

    static DungeonEditorPreview none() {
        return NonePreview.INSTANCE;
    }

    enum NonePreview implements DungeonEditorPreview {
        INSTANCE
    }

    record RoomRectanglePreview(
            DungeonCellRef start,
            DungeonCellRef end,
            boolean deleteMode
    ) implements DungeonEditorPreview {
        public RoomRectanglePreview {
            start = start == null ? new DungeonCellRef(0, 0, 0) : start;
            end = end == null ? new DungeonCellRef(0, 0, 0) : end;
        }
    }

    record ClusterBoundariesPreview(
            long clusterId,
            List<DungeonEdgeRef> edges,
            String boundaryKind,
            boolean deleteMode
    ) implements DungeonEditorPreview {
        public ClusterBoundariesPreview {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null || boundaryKind.isBlank() ? "WALL" : boundaryKind.trim();
        }
    }

    record StairCreatePreview(
            DungeonCellRef anchor,
            String shapeName
    ) implements DungeonEditorPreview {
        public StairCreatePreview {
            anchor = anchor == null ? new DungeonCellRef(0, 0, 0) : anchor;
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.trim();
        }
    }

    record MoveHandlePreview(
            DungeonEditorHandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorPreview {
        public MoveHandlePreview {
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        }
    }

    record MoveBoundaryStretchPreview(
            long clusterId,
            List<DungeonEdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorPreview {
        public MoveBoundaryStretchPreview {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }
    }
}
