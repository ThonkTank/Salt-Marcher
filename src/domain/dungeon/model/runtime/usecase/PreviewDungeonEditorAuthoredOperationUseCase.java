package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceHandleMovement;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.model.core.geometry.Direction;

public final class PreviewDungeonEditorAuthoredOperationUseCase {
    private static final long PREVIEW_STAIR_ID = Long.MAX_VALUE;

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final ApplyDungeonEditorCorridorMutationUseCase corridorMutationUseCase;
    private final ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredPublicationUseCase publicationUseCase =
            new DungeonEditorAuthoredPublicationUseCase();
    private final PreviewDungeonEditorSurfaceMoveUseCase surfaceMovePreviewUseCase =
            new PreviewDungeonEditorSurfaceMoveUseCase();

    public PreviewDungeonEditorAuthoredOperationUseCase(
            ApplyDungeonEditorOperationUseCase operationUseCase,
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            ApplyDungeonEditorCorridorMutationUseCase corridorMutationUseCase,
            ApplyDungeonRoomWallMutationUseCase roomWallMutationUseCase,
            DungeonEditorDungeonState state
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.corridorMutationUseCase = Objects.requireNonNull(corridorMutationUseCase, "corridorMutationUseCase");
        this.roomWallMutationUseCase = Objects.requireNonNull(roomWallMutationUseCase, "roomWallMutationUseCase");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (preview instanceof DungeonEditorSessionValues.StairCreatePreview stair) {
            publishPreview(stairPreview(mapId, stair));
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
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview move
                && move.handleRef().kind() == DungeonEditorHandleType.STAIR_ANCHOR) {
            publishPreview(mutationUseCase.previewHandleMovement(
                    domainMapId(mapId),
                    DungeonEditorWorkspaceHandleMovement.from(move.handleRef()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel()));
            return;
        }
        state.replacePreview(null);
    }

    private ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData stairPreview(
            MapId mapId,
            DungeonEditorSessionValues.StairCreatePreview stair
    ) {
        StairGeometrySpec spec = stairSpec(stair);
        if (mapId == null || spec == null || !stair.valid()) {
            return null;
        }
        return operationUseCase.preview(
                domainMapId(mapId),
                current -> current.createStair(
                        PREVIEW_STAIR_ID,
                        spec.anchor(),
                        spec.shape().name(),
                        spec.direction().name(),
                        spec.dimension1(),
                        spec.dimension2()));
    }

    private static @Nullable StairGeometrySpec stairSpec(DungeonEditorSessionValues.StairCreatePreview stair) {
        StairShape shape = StairShape.supportedEditorShape(stair.shapeName());
        Direction direction = Direction.supportedCardinal(stair.directionName());
        if (shape == null || direction == null) {
            return null;
        }
        return new StairGeometrySpec(
                shape,
                DungeonEditorWorkspaceCoreGeometry.cell(stair.specAnchor()),
                direction,
                stair.dimension1(),
                stair.dimension2());
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
