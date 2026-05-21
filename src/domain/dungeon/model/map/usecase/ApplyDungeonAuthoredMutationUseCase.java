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
        return switch (operation.variant()) {
            case DungeonEditorAuthoredOperation.PaintRoomRectangle rectangle ->
                    current -> current.paintRoomRectangle(rectangle.start(), rectangle.end());
            case DungeonEditorAuthoredOperation.DeleteRoomRectangle rectangle ->
                    current -> current.deleteRoomRectangle(rectangle.start(), rectangle.end());
            case DungeonEditorAuthoredOperation.EditClusterBoundaries boundaries ->
                    current -> current.editClusterBoundaries(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.boundaryKind(),
                            boundaries.deleteMode());
            case DungeonEditorAuthoredOperation.CreateCorridor corridor ->
                    current -> current.createCorridor(corridor.start(), corridor.end());
            case DungeonEditorAuthoredOperation.DeleteCorridor corridor ->
                    current -> current.deleteCorridor(corridor.corridorId());
            case DungeonEditorAuthoredOperation.MoveEditorHandle move ->
                    current -> current.moveEditorHandle(
                            move.handle(),
                            move.deltaQ(),
                            move.deltaR(),
                            move.deltaLevel());
            case DungeonEditorAuthoredOperation.MoveBoundaryStretch stretch ->
                    current -> current.moveBoundaryStretch(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorAuthoredOperation.SaveRoomNarration narration ->
                    current -> current.saveRoomNarration(narration.roomId(), narration.narration());
        };
    }
}
