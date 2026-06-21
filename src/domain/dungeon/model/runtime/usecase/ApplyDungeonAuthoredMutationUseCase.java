package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMutation;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorAuthoredOperation;

public final class ApplyDungeonAuthoredMutationUseCase {
    private static final String CLUSTER_KIND = "CLUSTER";
    private static final String ROOM_KIND = "ROOM";
    private static final DungeonEditorHandleMutation HANDLE_MUTATION =
            new DungeonEditorHandleMutation();

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final DungeonMapRepository repository;

    public ApplyDungeonAuthoredMutationUseCase(
            ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase,
            DungeonMapRepository repository
    ) {
        this.applyDungeonEditorOperationUseCase =
                Objects.requireNonNull(applyDungeonEditorOperationUseCase, "applyDungeonEditorOperationUseCase");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, mutation(operation, true));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, mutation(operation, false));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyMoveEditorHandle(
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

    private ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(
            @Nullable DungeonEditorAuthoredOperation operation,
            boolean reservePersistentIds
    ) {
        if (operation == null) {
            return null;
        }
        return switch (operation.variant()) {
            case DungeonEditorAuthoredOperation.EditClusterBoundaries boundaries ->
                    doorBoundaryMutation(boundaries);
            case DungeonEditorAuthoredOperation.CreateCorridor corridor ->
                    current -> current.createCorridor(
                            stairIdForCorridor(current, corridor, reservePersistentIds),
                            corridor.start(),
                            corridor.end());
            case DungeonEditorAuthoredOperation.DeleteCorridor corridor ->
                    current -> current.deleteCorridor(
                            corridor.corridorId(),
                            corridor.targetKind(),
                            corridor.topologyRefId(),
                            corridor.roomId(),
                            corridor.waypointIndex());
            case DungeonEditorAuthoredOperation.MoveEditorHandle move ->
                    current -> HANDLE_MUTATION.apply(
                            current,
                            move.handle(),
                            move.deltaQ(),
                            move.deltaR(),
                            move.deltaLevel());
        };
    }

    private static ApplyDungeonEditorOperationUseCase.Mutation doorBoundaryMutation(
            DungeonEditorAuthoredOperation.EditClusterBoundaries boundaries
    ) {
        if (boundaries.boundaryKind() != BoundaryKind.DOOR) {
            return current -> current;
        }
        return current -> current.editClusterBoundaries(
                boundaries.clusterId(),
                boundaries.edges(),
                boundaries.boundaryKind(),
                boundaries.deleteMode());
    }

    private long stairIdForCorridor(
            DungeonMap current,
            DungeonEditorAuthoredOperation.CreateCorridor corridor,
            boolean reservePersistentIds
    ) {
        if (corridor.start().sameLevelAs(corridor.end())) {
            return 0L;
        }
        return reservePersistentIds ? repository.nextStairId() : nextPreviewStairId(current);
    }

    private static long nextPreviewStairId(DungeonMap current) {
        long highestStairId = 0L;
        for (Stair stair : current.stairs().stairs()) {
            highestStairId = Math.max(highestStairId, stair.stairId());
        }
        return highestStairId + 1L;
    }
}
