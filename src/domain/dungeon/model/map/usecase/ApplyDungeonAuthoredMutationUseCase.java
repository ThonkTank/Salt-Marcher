package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public final class ApplyDungeonAuthoredMutationUseCase {

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;

    public ApplyDungeonAuthoredMutationUseCase(ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase) {
        this.applyDungeonEditorOperationUseCase =
                Objects.requireNonNull(applyDungeonEditorOperationUseCase, "applyDungeonEditorOperationUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, mutation(operation));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            ApplyDungeonEditorOperationUseCase.@Nullable Mutation operation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, operation);
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, mutation(operation));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            ApplyDungeonEditorOperationUseCase.@Nullable Mutation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, operation);
    }

    private static ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        if (operation == null) {
            return null;
        }
        return switch (operation.kind()) {
            case PAINT_ROOM_RECTANGLE -> current -> current.paintRoomRectangle(operation.start(), operation.end());
            case DELETE_ROOM_RECTANGLE -> current -> current.deleteRoomRectangle(operation.start(), operation.end());
            case EDIT_CLUSTER_BOUNDARIES -> current -> current.editClusterBoundaries(
                    operation.clusterId(),
                    operation.edges(),
                    operation.boundaryKind(),
                    operation.deleteMode());
            case CREATE_CORRIDOR -> current -> current.createCorridor(
                    operation.corridorStart(),
                    operation.corridorEnd());
            case DELETE_CORRIDOR -> current -> current.deleteCorridor(operation.corridorId());
            case MOVE_EDITOR_HANDLE -> current -> current.moveEditorHandle(
                    operation.handle(),
                    operation.deltaQ(),
                    operation.deltaR(),
                    operation.deltaLevel());
            case MOVE_BOUNDARY_STRETCH -> current -> current.moveBoundaryStretch(
                    operation.clusterId(),
                    operation.sourceEdges(),
                    operation.deltaQ(),
                    operation.deltaR(),
                    operation.deltaLevel());
            case SAVE_ROOM_NARRATION -> current -> current.saveRoomNarration(
                    operation.roomId(),
                    operation.narration());
        };
    }
}
