package src.domain.dungeon.model.map.model;

import java.util.List;

public final class DungeonEditorAuthoredOperation {

    private final Object variant;

    private DungeonEditorAuthoredOperation(Object variant) {
        this.variant = variant;
    }

    public Object variant() {
        return variant;
    }

    public static DungeonEditorAuthoredOperation paintRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonEditorAuthoredOperation(new PaintRoomRectangle(start, end));
    }

    public static DungeonEditorAuthoredOperation deleteRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonEditorAuthoredOperation(new DeleteRoomRectangle(start, end));
    }

    public static DungeonEditorAuthoredOperation editClusterBoundaries(
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind boundaryKind,
            boolean deleteMode
    ) {
        return new DungeonEditorAuthoredOperation(new EditClusterBoundaries(clusterId, edges, boundaryKind, deleteMode));
    }

    public static DungeonEditorAuthoredOperation createCorridor(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return new DungeonEditorAuthoredOperation(new CreateCorridor(start, end));
    }

    public static DungeonEditorAuthoredOperation deleteCorridor(long corridorId) {
        return new DungeonEditorAuthoredOperation(new DeleteCorridor(corridorId));
    }

    public static DungeonEditorAuthoredOperation moveEditorHandle(
            DungeonEditorHandle handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonEditorAuthoredOperation(new MoveEditorHandle(handle, deltaQ, deltaR, deltaLevel));
    }

    public static DungeonEditorAuthoredOperation moveBoundaryStretch(
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonEditorAuthoredOperation(
                new MoveBoundaryStretch(clusterId, sourceEdges, deltaQ, deltaR, deltaLevel));
    }

    public static DungeonEditorAuthoredOperation saveRoomNarration(
            long roomId,
            DungeonRoomNarration narration
    ) {
        return new DungeonEditorAuthoredOperation(new SaveRoomNarration(roomId, narration));
    }

    public static final class PaintRoomRectangle {
        private final DungeonCell start;
        private final DungeonCell end;

        private PaintRoomRectangle(DungeonCell start, DungeonCell end) {
            this.start = safeCell(start);
            this.end = safeCell(end);
        }

        public DungeonCell start() {
            return start;
        }

        public DungeonCell end() {
            return end;
        }
    }

    public static final class DeleteRoomRectangle {
        private final DungeonCell start;
        private final DungeonCell end;

        private DeleteRoomRectangle(DungeonCell start, DungeonCell end) {
            this.start = safeCell(start);
            this.end = safeCell(end);
        }

        public DungeonCell start() {
            return start;
        }

        public DungeonCell end() {
            return end;
        }
    }

    public static final class EditClusterBoundaries {
        private final long clusterId;
        private final List<DungeonEdge> edges;
        private final DungeonClusterBoundaryKind boundaryKind;
        private final boolean deleteMode;

        private EditClusterBoundaries(
                long clusterId,
                List<DungeonEdge> edges,
                DungeonClusterBoundaryKind boundaryKind,
                boolean deleteMode
        ) {
            this.clusterId = Math.max(0L, clusterId);
            this.edges = edges == null ? List.of() : List.copyOf(edges);
            this.boundaryKind = boundaryKind == null ? DungeonClusterBoundaryKind.WALL : boundaryKind;
            this.deleteMode = deleteMode;
        }

        public long clusterId() {
            return clusterId;
        }

        public List<DungeonEdge> edges() {
            return List.copyOf(edges);
        }

        public DungeonClusterBoundaryKind boundaryKind() {
            return boundaryKind;
        }

        public boolean deleteMode() {
            return deleteMode;
        }
    }

    public static final class CreateCorridor {
        private final DungeonCorridorEndpoint start;
        private final DungeonCorridorEndpoint end;

        private CreateCorridor(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
            this.start = start;
            this.end = end;
        }

        public DungeonCorridorEndpoint start() {
            return start;
        }

        public DungeonCorridorEndpoint end() {
            return end;
        }
    }

    public static final class DeleteCorridor {
        private final long corridorId;

        private DeleteCorridor(long corridorId) {
            this.corridorId = Math.max(0L, corridorId);
        }

        public long corridorId() {
            return corridorId;
        }
    }

    public static final class MoveEditorHandle {
        private final DungeonEditorHandle handle;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        private MoveEditorHandle(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
            this.handle = handle;
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public DungeonEditorHandle handle() {
            return handle;
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }

        public int deltaLevel() {
            return deltaLevel;
        }
    }

    public static final class MoveBoundaryStretch {
        private final long clusterId;
        private final List<DungeonEdge> sourceEdges;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        private MoveBoundaryStretch(
                long clusterId,
                List<DungeonEdge> sourceEdges,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            this.clusterId = Math.max(0L, clusterId);
            this.sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public long clusterId() {
            return clusterId;
        }

        public List<DungeonEdge> sourceEdges() {
            return List.copyOf(sourceEdges);
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }

        public int deltaLevel() {
            return deltaLevel;
        }
    }

    public static final class SaveRoomNarration {
        private final long roomId;
        private final DungeonRoomNarration narration;

        private SaveRoomNarration(long roomId, DungeonRoomNarration narration) {
            this.roomId = Math.max(0L, roomId);
            this.narration = narration;
        }

        public long roomId() {
            return roomId;
        }

        public DungeonRoomNarration narration() {
            return narration;
        }
    }

    private static DungeonCell safeCell(DungeonCell cell) {
        return cell == null ? new DungeonCell(0, 0, 0) : cell;
    }
}
