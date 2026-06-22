package src.domain.dungeon.model.runtime.editor.session;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
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
            CreateCorridor,
            DeleteCorridor,
            MoveEditorHandle {
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
