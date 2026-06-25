package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMutation;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

public final class ApplyDungeonAuthoredMutationUseCase {
    private static final String CLUSTER_KIND = "CLUSTER";
    private static final String ROOM_KIND = "ROOM";
    private static final DungeonEditorHandleMutation HANDLE_MUTATION =
            new DungeonEditorHandleMutation();

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;

    public ApplyDungeonAuthoredMutationUseCase(
            ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase
    ) {
        this.applyDungeonEditorOperationUseCase =
                Objects.requireNonNull(applyDungeonEditorOperationUseCase, "applyDungeonEditorOperationUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyHandleMovement(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return applyDungeonEditorOperationUseCase.execute(
                mapId,
                current -> HANDLE_MUTATION.apply(current, handle, deltaQ, deltaR, deltaLevel));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData previewHandleMovement(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return applyDungeonEditorOperationUseCase.preview(
                mapId,
                current -> HANDLE_MUTATION.apply(current, handle, deltaQ, deltaR, deltaLevel));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyBoundaryStretch(
            @Nullable DungeonMapIdentity mapId,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Edge> safeSourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        return applyDungeonEditorOperationUseCase.execute(
                mapId,
                current -> current.moveBoundaryStretch(clusterId, safeSourceEdges, deltaQ, deltaR, deltaLevel));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData previewBoundaryStretch(
            @Nullable DungeonMapIdentity mapId,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Edge> safeSourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        return applyDungeonEditorOperationUseCase.preview(
                mapId,
                current -> current.moveBoundaryStretch(clusterId, safeSourceEdges, deltaQ, deltaR, deltaLevel));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applySaveLabelName(
            @Nullable DungeonMapIdentity mapId,
            String targetKind,
            long targetId,
            String name
    ) {
        String normalizedTargetKind = targetKind == null ? "" : targetKind.trim().toUpperCase(Locale.ROOT);
        String trimmedName = name == null ? "" : name.trim();
        return applyDungeonEditorOperationUseCase.execute(mapId, current -> {
            if (CLUSTER_KIND.equals(normalizedTargetKind)) {
                return current.saveClusterName(targetId, trimmedName);
            }
            if (ROOM_KIND.equals(normalizedTargetKind)) {
                return current.saveRoomName(targetId, trimmedName);
            }
            return current;
        });
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applySaveRoomNarration(
            @Nullable DungeonMapIdentity mapId,
            long roomId,
            DungeonRoomNarration narration
    ) {
        return applyDungeonEditorOperationUseCase.execute(
                mapId,
                current -> current.saveRoomNarration(roomId, narration));
    }

}
