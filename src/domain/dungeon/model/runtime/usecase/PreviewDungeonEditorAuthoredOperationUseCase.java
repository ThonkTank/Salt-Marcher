package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.helper.DungeonEditorAuthoredOperationHelper;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;

public final class PreviewDungeonEditorAuthoredOperationUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final ApplyDungeonEditorCorridorMutationUseCase corridorMutationUseCase;
    private final ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredPublicationUseCase publicationUseCase =
            new DungeonEditorAuthoredPublicationUseCase();
    private final PreviewDungeonEditorSurfaceMoveUseCase surfaceMovePreviewUseCase =
            new PreviewDungeonEditorSurfaceMoveUseCase();

    public PreviewDungeonEditorAuthoredOperationUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            ApplyDungeonEditorCorridorMutationUseCase corridorMutationUseCase,
            ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase,
            DungeonEditorDungeonState state
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.corridorMutationUseCase = Objects.requireNonNull(corridorMutationUseCase, "corridorMutationUseCase");
        this.roomWallMutationUseCase = Objects.requireNonNull(roomWallMutationUseCase, "roomWallMutationUseCase");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (preview instanceof DungeonEditorSessionValues.StairCreatePreview) {
            state.replacePreview(null);
            return;
        }
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            publishPreview(roomWallMutationUseCase.previewRoomRectangle(
                    domainMapId(mapId),
                    new ApplyDungeonRoomWallMutationUseCase.RoomRectangleMutation(
                            DungeonEditorWorkspaceCoreGeometry.cell(room.start()),
                            DungeonEditorWorkspaceCoreGeometry.cell(room.end()),
                            room.deleteMode())));
            return;
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries
                && !boundaries.boundaryKind().isDoor()) {
            publishPreview(roomWallMutationUseCase.previewClusterBoundaries(
                    domainMapId(mapId),
                    new ApplyDungeonRoomWallMutationUseCase.ClusterBoundaryMutation(
                            boundaries.clusterId(),
                            DungeonEditorWorkspaceCoreGeometry.edges(boundaries.edges()),
                            DungeonEditorWorkspaceCoreGeometry.boundaryKind(boundaries.boundaryKind()),
                            boundaries.deleteMode())));
            return;
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
            publishPreview(corridorMutationUseCase.previewCreate(
                    domainMapId(mapId),
                    corridor.start(),
                    corridor.end()));
            return;
        }
        if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridor) {
            publishPreview(corridorMutationUseCase.previewDelete(
                    domainMapId(mapId),
                    corridor.corridorId(),
                    corridor.targetKind(),
                    corridor.topologyRefId(),
                    corridor.roomId(),
                    corridor.waypointIndex()));
            return;
        }
        DungeonEditorAuthoredOperation operation =
                DungeonEditorAuthoredOperationHelper.authoredOperation(preview);
        if (operation == null) {
            state.replacePreview(null);
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.preview(
                domainMapId(mapId),
                operation);
        publishPreview(result);
    }

    public void executeInMemory(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            DungeonEditorSessionValues.Preview preview
    ) {
        state.replacePreview(surfaceMovePreviewUseCase.execute(surface, preview));
    }

    public void publishPreview(ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData preview) {
        state.replacePreview(previewFacts(preview));
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private DungeonEditorDungeonState.@Nullable PreviewFacts previewFacts(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData preview
    ) {
        DungeonEditorAuthoredPublicationUseCase.Publication publication = publication(preview);
        if (publication == null) {
            return null;
        }
        return new DungeonEditorDungeonState.PreviewFacts(publication.stateFacts(), statusText(preview));
    }

    private DungeonEditorAuthoredPublicationUseCase.Publication publication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData preview
    ) {
        if (preview == null || preview.snapshot() == null) {
            return null;
        }
        return publicationUseCase.execute(
                preview.snapshot().mapName(),
                preview.snapshot().derived(),
                preview.snapshot().editorHandles(),
                preview.snapshot().revision());
    }

    private static String statusText(ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData preview) {
        if (preview == null) {
            return "";
        }
        if (!preview.reactionMessages().isEmpty()) {
            return preview.reactionMessages().getFirst();
        }
        if (!preview.validationMessages().isEmpty()) {
            return preview.validationMessages().getFirst();
        }
        return "";
    }
}
