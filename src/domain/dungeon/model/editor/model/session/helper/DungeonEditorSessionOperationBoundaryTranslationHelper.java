package src.domain.dungeon.model.editor.model.session.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceCellBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceHandleBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceOperationBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceTopologyBoundaryTranslationHelper;

public final class DungeonEditorSessionOperationBoundaryTranslationHelper {

    private DungeonEditorSessionOperationBoundaryTranslationHelper() {
    }

    public static @Nullable DungeonEditorOperation toDungeonOperation(DungeonEditorSessionValues.Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        DungeonEditorOperation operation = roomRectangleOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = boundaryOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = corridorCreateOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = corridorDeleteOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = moveHandleOperation(preview);
        if (operation != null) {
            return operation;
        }
        return moveBoundaryStretchOperation(preview);
    }

    private static @Nullable DungeonEditorOperation roomRectangleOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room)) {
            return null;
        }
        return new DungeonEditorOperation.RoomRectangle(
                DungeonEditorOperation.RectangleAction.fromDeleteMode(room.deleteMode()),
                DungeonEditorWorkspaceCellBoundaryTranslationHelper.toDomainCell(room.start()),
                DungeonEditorWorkspaceCellBoundaryTranslationHelper.toDomainCell(room.end()));
    }

    private static @Nullable DungeonEditorOperation boundaryOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries)) {
            return null;
        }
        return new DungeonEditorOperation.EditClusterBoundaries(
                boundaries.clusterId(),
                boundaries.edges().stream()
                         .map(DungeonEditorWorkspaceCellBoundaryTranslationHelper::toDomainEdge)
                        .toList(),
                 DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainBoundaryKind(boundaries.boundaryKind()),
                boundaries.deleteMode());
    }

    private static @Nullable DungeonEditorOperation corridorCreateOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor)) {
            return null;
        }
        return new DungeonEditorOperation.CreateCorridor(
                 DungeonEditorWorkspaceOperationBoundaryTranslationHelper.toDomainCorridorEndpoint(corridor.start()),
                 DungeonEditorWorkspaceOperationBoundaryTranslationHelper.toDomainCorridorEndpoint(corridor.end()));
    }

    private static @Nullable DungeonEditorOperation corridorDeleteOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.CorridorDeletePreview corridor)) {
            return null;
        }
        return new DungeonEditorOperation.DeleteCorridor(corridor.corridorId());
    }

    private static @Nullable DungeonEditorOperation moveHandleOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle)) {
            return null;
        }
        return new DungeonEditorOperation.MoveEditorHandle(
                 DungeonEditorWorkspaceHandleBoundaryTranslationHelper.toDomainHandleRef(moveHandle.handleRef()),
                moveHandle.deltaQ(),
                moveHandle.deltaR(),
                moveHandle.deltaLevel());
    }

    private static @Nullable DungeonEditorOperation moveBoundaryStretchOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch)) {
            return null;
        }
        return new DungeonEditorOperation.MoveBoundaryStretch(
                stretch.clusterId(),
                stretch.sourceEdges().stream()
                         .map(DungeonEditorWorkspaceCellBoundaryTranslationHelper::toDomainEdge)
                        .toList(),
                stretch.deltaQ(),
                stretch.deltaR(),
                stretch.deltaLevel());
    }
}
