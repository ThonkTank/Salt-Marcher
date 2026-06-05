package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

public final class DungeonEditorAuthoredOperation {

    private final Variant variant;

    private DungeonEditorAuthoredOperation(Variant variant) {
        this.variant = Objects.requireNonNull(variant, "variant");
    }

    public Variant variant() {
        return variant;
    }

    public sealed interface Variant permits
            PaintRoomRectangle,
            DeleteRoomRectangle,
            EditClusterBoundaries,
            CreateCorridor,
            DeleteCorridor,
            MoveEditorHandle,
            MoveBoundaryStretch,
            SaveRoomNarration {
    }

    public static DungeonEditorAuthoredOperation paintRoomRectangle(Cell start, Cell end) {
        return new DungeonEditorAuthoredOperation(new PaintRoomRectangle(start, end));
    }

    public static DungeonEditorAuthoredOperation deleteRoomRectangle(Cell start, Cell end) {
        return new DungeonEditorAuthoredOperation(new DeleteRoomRectangle(start, end));
    }

    public static DungeonEditorAuthoredOperation editClusterBoundaries(
            long clusterId,
            List<Edge> edges,
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

    public static DungeonEditorAuthoredOperation deleteCorridor(
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return new DungeonEditorAuthoredOperation(
                new DeleteCorridor(corridorId, targetKind, topologyRefId, roomId, waypointIndex));
    }

    public static DungeonEditorAuthoredOperation moveEditorHandle(
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonEditorAuthoredOperation(new MoveEditorHandle(handle, deltaQ, deltaR, deltaLevel));
    }

    public static DungeonEditorAuthoredOperation moveBoundaryStretch(
            long clusterId,
            List<Edge> sourceEdges,
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

    public static final class PaintRoomRectangle implements Variant {
        private final Cell start;
        private final Cell end;

        private PaintRoomRectangle(Cell start, Cell end) {
            this.start = safeCell(start);
            this.end = safeCell(end);
        }

        public Cell start() {
            return start;
        }

        public Cell end() {
            return end;
        }
    }

    public static final class DeleteRoomRectangle implements Variant {
        private final Cell start;
        private final Cell end;

        private DeleteRoomRectangle(Cell start, Cell end) {
            this.start = safeCell(start);
            this.end = safeCell(end);
        }

        public Cell start() {
            return start;
        }

        public Cell end() {
            return end;
        }
    }

    public static final class EditClusterBoundaries implements Variant {
        private final long clusterId;
        private final List<Edge> edges;
        private final DungeonClusterBoundaryKind boundaryKind;
        private final boolean deleteMode;

        private EditClusterBoundaries(
                long clusterId,
                List<Edge> edges,
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

        public List<Edge> edges() {
            return List.copyOf(edges);
        }

        public DungeonClusterBoundaryKind boundaryKind() {
            return boundaryKind;
        }

        public boolean deleteMode() {
            return deleteMode;
        }
    }

    public static final class CreateCorridor implements Variant {
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

    public record DeleteCorridor(
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) implements Variant {
        public DeleteCorridor {
            corridorId = Math.max(0L, corridorId);
            targetKind = targetKind == null || targetKind.isBlank() ? "CORRIDOR" : targetKind;
            topologyRefId = Math.max(0L, topologyRefId);
            roomId = Math.max(0L, roomId);
            waypointIndex = Math.max(0, waypointIndex);
        }
    }

    public static final class MoveEditorHandle implements Variant {
        private final DungeonEditorHandleMovement handle;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        private MoveEditorHandle(DungeonEditorHandleMovement handle, int deltaQ, int deltaR, int deltaLevel) {
            this.handle = handle;
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public DungeonEditorHandleMovement handle() {
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

    public static final class MoveBoundaryStretch implements Variant {
        private final long clusterId;
        private final List<Edge> sourceEdges;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        private MoveBoundaryStretch(
                long clusterId,
                List<Edge> sourceEdges,
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

        public List<Edge> sourceEdges() {
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

    public static final class SaveRoomNarration implements Variant {
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

    private static Cell safeCell(Cell cell) {
        return cell == null ? new Cell(0, 0, 0) : cell;
    }
}
