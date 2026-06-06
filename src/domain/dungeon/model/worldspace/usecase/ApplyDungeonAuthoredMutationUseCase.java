package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonStair;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;

public final class ApplyDungeonAuthoredMutationUseCase {

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

    ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            ApplyDungeonEditorOperationUseCase.Mutation mutation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, mutation);
    }

    boolean canCreateStair(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Cell anchor,
            String shapeName
    ) {
        return applyDungeonEditorOperationUseCase.canCreateStair(mapId, anchor, shapeName);
    }

    boolean canCreateTransition(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Cell anchor,
            @Nullable TransitionDestination destination
    ) {
        return applyDungeonEditorOperationUseCase.canCreateTransition(mapId, anchor, destination);
    }

    boolean canSaveStairGeometry(
            @Nullable DungeonMapIdentity mapId,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return applyDungeonEditorOperationUseCase.canSaveStairGeometry(
                mapId,
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2);
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, mutation(operation, false));
    }

    private ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(
            @Nullable DungeonEditorAuthoredOperation operation,
            boolean reservePersistentIds
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
        for (DungeonStair stair : current.connections().stairs()) {
            highestStairId = Math.max(highestStairId, stair.stairId());
        }
        return highestStairId + 1L;
    }
}
