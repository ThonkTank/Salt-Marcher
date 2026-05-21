package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredOperationHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class ApplyDungeonEditorAuthoredOperationUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public ApplyDungeonEditorAuthoredOperationUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        ApplyDungeonEditorOperationUseCase.Mutation mutation = mutation(preview);
        if (mutation == null) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                mutation);
        state.replaceMutation(mutationFacts(result));
        publishedStateRepository.publishMutation(mutationPublication(result));
    }

    static DungeonEditorDungeonState.@Nullable MutationFacts mutationFacts(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        DungeonEditorDungeonState.SnapshotFacts snapshot =
                mutation == null ? null : LoadDungeonEditorAuthoredMapUseCase.snapshotFacts(mutation.snapshot());
        return snapshot == null ? null : new DungeonEditorDungeonState.MutationFacts(snapshot, statusText(mutation));
    }

    static DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutationPublication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        if (mutation == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.MutationPublication(
                LoadDungeonEditorAuthoredMapUseCase.snapshotPublication(mutation.snapshot()),
                mutation.validationMessages(),
                mutation.reactionMessages());
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    static ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            return room.deleteMode()
                    ? current -> current.deleteRoomRectangle(
                            DungeonEditorAuthoredOperationHelper.cell(room.start()),
                            DungeonEditorAuthoredOperationHelper.cell(room.end()))
                    : current -> current.paintRoomRectangle(
                            DungeonEditorAuthoredOperationHelper.cell(room.start()),
                            DungeonEditorAuthoredOperationHelper.cell(room.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries) {
            return current -> current.editClusterBoundaries(
                    boundaries.clusterId(),
                    DungeonEditorAuthoredOperationHelper.edges(boundaries.edges()),
                    DungeonEditorAuthoredOperationHelper.boundaryKind(boundaries.boundaryKind()),
                    boundaries.deleteMode());
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
            return current -> current.createCorridor(
                    DungeonEditorAuthoredOperationHelper.corridorEndpoint(corridor.start()),
                    DungeonEditorAuthoredOperationHelper.corridorEndpoint(corridor.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridorDelete) {
            return current -> current.deleteCorridor(corridorDelete.corridorId());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle) {
            return current -> current.moveEditorHandle(
                    DungeonEditorAuthoredOperationHelper.handle(moveHandle.handleRef()),
                    moveHandle.deltaQ(),
                    moveHandle.deltaR(),
                    moveHandle.deltaLevel());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return current -> current.moveBoundaryStretch(
                    stretch.clusterId(),
                    DungeonEditorAuthoredOperationHelper.edges(stretch.sourceEdges()),
                    stretch.deltaQ(),
                    stretch.deltaR(),
                    stretch.deltaLevel());
        }
        return null;
    }

    private static String statusText(ApplyDungeonEditorOperationUseCase.OperationResultData mutation) {
        if (!mutation.reactionMessages().isEmpty()) {
            return mutation.reactionMessages().getFirst();
        }
        if (!mutation.validationMessages().isEmpty()) {
            return mutation.validationMessages().getFirst();
        }
        return "";
    }
}
