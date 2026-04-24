package src.domain.dungeon.published;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveTopologyElement,
        DungeonEditorOperation.MoveEditorHandle,
        DungeonEditorOperation.MoveBoundaryStretch,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.PaintRoomRectangle,
        DungeonEditorOperation.DeleteRoomRectangle,
        DungeonEditorOperation.EditClusterBoundaries,
        DungeonEditorOperation.SaveRoomNarration {

    record MoveTopologyElement(
            DungeonTopologyElementRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveTopologyElement(DungeonTopologyElementRef ref, int deltaQ, int deltaR) {
            this(ref, deltaQ, deltaR, 0);
        }
    }

    record MoveEditorHandle(
            DungeonEditorHandleRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
    }

    record MoveBoundaryStretch(
            long clusterId,
            java.util.List<DungeonEdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveBoundaryStretch {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? java.util.List.of() : java.util.List.copyOf(sourceEdges);
        }
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record PaintRoomRectangle(DungeonCellRef start, DungeonCellRef end) implements DungeonEditorOperation {
    }

    record DeleteRoomRectangle(DungeonCellRef start, DungeonCellRef end) implements DungeonEditorOperation {
    }

    record EditClusterBoundaries(
            long clusterId,
            java.util.List<DungeonEdgeRef> edges,
            DungeonBoundaryKind kind,
            boolean deleteBoundary
    ) implements DungeonEditorOperation {
        public EditClusterBoundaries {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? java.util.List.of() : java.util.List.copyOf(edges);
            kind = kind == null ? DungeonBoundaryKind.WALL : kind;
        }
    }

    record SaveRoomNarration(
            long roomId,
            String visualDescription,
            java.util.List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) implements DungeonEditorOperation {
        public SaveRoomNarration {
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? java.util.List.of() : java.util.List.copyOf(exits);
        }
    }
}
