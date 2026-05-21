package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredOperationHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class ApplyDungeonEditorAuthoredOperationUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public ApplyDungeonEditorAuthoredOperationUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void execute(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        DungeonEditorAuthoredOperation operation = authoredOperation(preview);
        if (operation == null) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                operation);
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    static @Nullable DungeonEditorAuthoredOperation authoredOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            return room.deleteMode()
                    ? DungeonEditorAuthoredOperation.deleteRoomRectangle(
                            DungeonEditorAuthoredOperationHelper.cell(room.start()),
                            DungeonEditorAuthoredOperationHelper.cell(room.end()))
                    : DungeonEditorAuthoredOperation.paintRoomRectangle(
                            DungeonEditorAuthoredOperationHelper.cell(room.start()),
                            DungeonEditorAuthoredOperationHelper.cell(room.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries) {
            return DungeonEditorAuthoredOperation.editClusterBoundaries(
                    boundaries.clusterId(),
                    DungeonEditorAuthoredOperationHelper.edges(boundaries.edges()),
                    DungeonEditorAuthoredOperationHelper.boundaryKind(boundaries.boundaryKind()),
                    boundaries.deleteMode());
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
            return DungeonEditorAuthoredOperation.createCorridor(
                    DungeonEditorAuthoredOperationHelper.corridorEndpoint(corridor.start()),
                    DungeonEditorAuthoredOperationHelper.corridorEndpoint(corridor.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridorDelete) {
            return DungeonEditorAuthoredOperation.deleteCorridor(corridorDelete.corridorId());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle) {
            return DungeonEditorAuthoredOperation.moveEditorHandle(
                    DungeonEditorAuthoredOperationHelper.handle(moveHandle.handleRef()),
                    moveHandle.deltaQ(),
                    moveHandle.deltaR(),
                    moveHandle.deltaLevel());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return DungeonEditorAuthoredOperation.moveBoundaryStretch(
                    stretch.clusterId(),
                    DungeonEditorAuthoredOperationHelper.edges(stretch.sourceEdges()),
                    stretch.deltaQ(),
                    stretch.deltaR(),
                    stretch.deltaLevel());
        }
        return null;
    }
}
