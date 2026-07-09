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
import src.domain.dungeon.model.runtime.helper.DungeonEditorSessionPreviewHelper;

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
    private final AuthoredPreviewDispatcher authoredPreviews = new AuthoredPreviewDispatcher();

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

    public void execute(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        state.replacePreview(previewFacts(authoredPreviews.preview(mapId, preview)));
    }

    public boolean executeAuthoredDragPreview(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (!directAuthoredDragPreview(preview)) {
            return false;
        }
        execute(mapId, preview);
        return true;
    }

    public void executeInMemory(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            DungeonEditorSessionValues.Preview preview
    ) {
        state.replacePreview(surfaceMovePreviewUseCase.execute(surface, preview));
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

    private static boolean directAuthoredDragPreview(DungeonEditorSessionValues.Preview preview) {
        return preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview
                || preview instanceof DungeonEditorSessionValues.MoveHandlePreview move
                && DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(move.handleRef().kind());
    }

    private final class AuthoredPreviewDispatcher {
        private ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData preview(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (mapId == null) {
                return null;
            }
            DungeonMapIdentity domainMapId = new DungeonMapIdentity(mapId.value());
            if (preview instanceof DungeonEditorSessionValues.StairCreatePreview stair) {
                return stairPreview(mapId, domainMapId, stair);
            }
            ApplyDungeonEditorOperationUseCase.OperationResultData roomWallPreview =
                    roomWallPreview(domainMapId, preview);
            if (roomWallPreview != null) {
                return roomWallPreview;
            }
            ApplyDungeonEditorOperationUseCase.OperationResultData corridorPreview =
                    corridorPreview(domainMapId, preview);
            if (corridorPreview != null) {
                return corridorPreview;
            }
            return movePreview(domainMapId, preview);
        }

        private ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData roomWallPreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
                return roomWallMutationUseCase.previewRoomRectangle(
                        domainMapId,
                        new ApplyDungeonRoomWallMutationUseCase.RoomRectangleMutation(
                                DungeonEditorWorkspaceCoreGeometry.cell(room.start()),
                                DungeonEditorWorkspaceCoreGeometry.cell(room.end()),
                                room.deleteMode()));
            }
            if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries
                    && !boundaries.boundaryKind().isDoor()) {
                return roomWallMutationUseCase.previewClusterBoundaries(
                        domainMapId,
                        new ApplyDungeonRoomWallMutationUseCase.ClusterBoundaryMutation(
                                boundaries.clusterId(),
                                DungeonEditorWorkspaceCoreGeometry.edges(boundaries.edges()),
                                DungeonEditorWorkspaceCoreGeometry.boundaryKind(boundaries.boundaryKind()),
                                boundaries.deleteMode()));
            }
            return null;
        }

        private ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData corridorPreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
                return corridorMutationUseCase.previewCreate(domainMapId, corridor.start(), corridor.end());
            }
            if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridor) {
                return corridorMutationUseCase.previewDelete(
                        domainMapId,
                        corridor.target());
            }
            return null;
        }

        private ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData movePreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview move
                    && (move.handleRef().kind() == DungeonEditorHandleType.STAIR_ANCHOR
                    || DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(move.handleRef().kind()))) {
                return mutationUseCase.previewHandleMovement(
                        domainMapId,
                        DungeonEditorWorkspaceHandleMovement.from(move.handleRef()),
                        move.deltaQ(),
                        move.deltaR(),
                        move.deltaLevel());
            }
            if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
                return mutationUseCase.previewBoundaryStretch(
                        domainMapId,
                        stretch.clusterId(),
                        DungeonEditorWorkspaceCoreGeometry.edges(stretch.sourceEdges()),
                        stretch.deltaQ(),
                        stretch.deltaR(),
                        stretch.deltaLevel());
            }
            return null;
        }

        private ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData stairPreview(
                MapId mapId,
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.StairCreatePreview stair
        ) {
            StairGeometrySpec spec = stairSpec(stair);
            if (mapId == null || spec == null || !stair.valid()) {
                return null;
            }
            return operationUseCase.preview(
                    domainMapId,
                    current -> current.createStair(
                            PREVIEW_STAIR_ID,
                            spec.anchor(),
                            spec.shape().name(),
                            spec.direction().name(),
                            spec.dimension1(),
                            spec.dimension2()));
        }

        private @Nullable StairGeometrySpec stairSpec(DungeonEditorSessionValues.StairCreatePreview stair) {
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
    }
}
