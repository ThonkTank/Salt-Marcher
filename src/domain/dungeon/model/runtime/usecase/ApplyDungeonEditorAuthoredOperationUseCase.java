package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.helper.DungeonEditorAuthoredOperationHelper;

public final class ApplyDungeonEditorAuthoredOperationUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public ApplyDungeonEditorAuthoredOperationUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.roomWallMutationUseCase = Objects.requireNonNull(roomWallMutationUseCase, "roomWallMutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void execute(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        DungeonEditorAuthoredOperation operation = DungeonEditorAuthoredOperationHelper.authoredOperation(preview);
        if (operation == null) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                operation);
        publishMutationUseCase.execute(result);
    }

    public void executeRoomRectangle(
            MapId mapId,
            Cell start,
            Cell end,
            boolean deleteMode
    ) {
        ApplyDungeonEditorOperationUseCase.OperationResultData result = roomWallMutationUseCase.applyRoomRectangle(
                domainMapId(mapId),
                new ApplyDungeonRoomWallMutationUseCase.RoomRectangleMutation(start, end, deleteMode));
        publishMutationUseCase.execute(result);
    }

    public void executeClusterBoundaries(
            MapId mapId,
            long clusterId,
            List<Edge> edges,
            BoundaryKind boundaryKind,
            boolean deleteMode
    ) {
        ApplyDungeonEditorOperationUseCase.OperationResultData result = roomWallMutationUseCase.applyClusterBoundaries(
                domainMapId(mapId),
                new ApplyDungeonRoomWallMutationUseCase.ClusterBoundaryMutation(
                        clusterId,
                        edges,
                        boundaryKind,
                        deleteMode));
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
