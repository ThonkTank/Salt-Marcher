package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
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
            EditClusterBoundaries,
            CreateCorridor,
            DeleteCorridor,
            MoveEditorHandle {
    }

    public static DungeonEditorAuthoredOperation editClusterBoundaries(
            long clusterId,
            List<Edge> edges,
            BoundaryKind boundaryKind,
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

    public static final class EditClusterBoundaries implements Variant {
        private final long clusterId;
        private final List<Edge> edges;
        private final BoundaryKind boundaryKind;
        private final boolean deleteMode;

        private EditClusterBoundaries(
                long clusterId,
                List<Edge> edges,
                BoundaryKind boundaryKind,
                boolean deleteMode
        ) {
            this.clusterId = Math.max(0L, clusterId);
            this.edges = edges == null ? List.of() : List.copyOf(edges);
            this.boundaryKind = boundaryKind == null ? BoundaryKind.WALL : boundaryKind;
            this.deleteMode = deleteMode;
        }

        public long clusterId() {
            return clusterId;
        }

        public List<Edge> edges() {
            return List.copyOf(edges);
        }

        public BoundaryKind boundaryKind() {
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

}
