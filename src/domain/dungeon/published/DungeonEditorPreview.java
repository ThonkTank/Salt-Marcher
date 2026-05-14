package src.domain.dungeon.published;

import java.util.List;

public sealed interface DungeonEditorPreview permits DungeonEditorPreview.NonePreview,
        DungeonEditorPreview.RoomRectanglePreview,
        DungeonEditorPreview.ClusterBoundariesPreview,
        DungeonEditorPreview.MoveHandlePreview,
        DungeonEditorPreview.MoveBoundaryStretchPreview {

    static DungeonEditorPreview none() {
        return NonePreview.INSTANCE;
    }

    enum NonePreview implements DungeonEditorPreview {
        INSTANCE
    }

    record RoomRectanglePreview(
            DungeonEditorCell start,
            DungeonEditorCell end,
            boolean deleteMode
    ) implements DungeonEditorPreview {
        public RoomRectanglePreview {
            start = start == null ? new DungeonEditorCell(0, 0, 0) : start;
            end = end == null ? new DungeonEditorCell(0, 0, 0) : end;
        }
    }

    record ClusterBoundariesPreview(
            long clusterId,
            List<DungeonEditorEdge> edges,
            String boundaryKind,
            boolean deleteMode
    ) implements DungeonEditorPreview {
        public ClusterBoundariesPreview {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null || boundaryKind.isBlank() ? "WALL" : boundaryKind.trim();
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
            List<DungeonEditorEdge> sourceEdges,
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
