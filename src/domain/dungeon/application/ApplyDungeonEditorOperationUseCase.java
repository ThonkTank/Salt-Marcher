package src.domain.dungeon.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapCorridorOps;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonMapOperationFeedbackRules;
import src.domain.dungeon.model.map.model.DungeonMapTopologyOps;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    private static final DungeonMapOperationFeedbackRules OPERATION_FEEDBACK_POLICY =
            new DungeonMapOperationFeedbackRules();

    public record OperationResultData(
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public OperationResultData {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final DungeonMapRepository repository;
    private final BuildDungeonDerivedStateUseCase deriveState;
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot;
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles;

    public ApplyDungeonEditorOperationUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase deriveState,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshot,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles
    ) {
        this.loadDungeonMap = Objects.requireNonNull(loadDungeonMap, "loadDungeonMap");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
        this.assembleDungeonSnapshot = Objects.requireNonNull(assembleDungeonSnapshot, "assembleDungeonSnapshot");
        this.publishDungeonEditorHandles = Objects.requireNonNull(
                publishDungeonEditorHandles,
                "publishDungeonEditorHandles");
    }

    public OperationResultData execute(DungeonEditorOperationInstructionUseCase.Instruction operation) {
        return execute(null, operation);
    }

    public OperationResultData execute(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorOperationInstructionUseCase.Instruction operation
    ) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = applyOperation(current, operation);
        List<String> validationMessages = OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated);
        List<String> reactionMessages = OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated);
        DungeonDerivedState derived = deriveState.execute(mutated);
        DungeonMap saved = repository.save(mutated);
        var snapshot = snapshot(saved, derived);
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    public OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorOperationInstructionUseCase.Instruction operation
    ) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = applyOperation(current, operation);
        DungeonDerivedState derived = deriveState.execute(mutated);
        return new OperationResultData(
                snapshot(mutated, derived),
                OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated),
                OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated));
    }

    private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot(DungeonMap dungeonMap, DungeonDerivedState derived) {
        return assembleDungeonSnapshot.execute(
                dungeonMap,
                derived,
                publishDungeonEditorHandles.execute(dungeonMap));
    }

    private DungeonMap currentMap(@Nullable DungeonMapIdentity mapId) {
        return loadDungeonMap.execute(mapId);
    }

    private static DungeonMap applyOperation(
            DungeonMap current,
            DungeonEditorOperationInstructionUseCase.Instruction operation
    ) {
        if (operation == null) {
            return current;
        }
        return switch (operation) {
            case DungeonEditorOperationInstructionUseCase.Identity ignored -> current;
            case DungeonEditorOperationInstructionUseCase.MoveTopologyElement move -> DungeonMapTopologyOps.moveTopologyElement(
                    current,
                    move.ref(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperationInstructionUseCase.MoveEditorHandle move -> DungeonMapTopologyOps.moveEditorHandle(
                    current,
                    move.handle(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperationInstructionUseCase.MoveBoundaryStretch move -> DungeonMapTopologyOps.moveBoundaryStretch(
                    current,
                    move.clusterId(),
                    move.sourceEdges(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperationInstructionUseCase.MoveRoomAnchor move ->
                    DungeonMapTopologyOps.moveRoomAnchor(current, move.deltaQ(), move.deltaR());
            case DungeonEditorOperationInstructionUseCase.RoomRectangle rectangle -> rectangle.deletesRoomCells()
                    ? DungeonMapTopologyOps.deleteRoomRectangle(current, rectangle.start(), rectangle.end())
                    : DungeonMapTopologyOps.paintRoomRectangle(current, rectangle.start(), rectangle.end());
            case DungeonEditorOperationInstructionUseCase.EditClusterBoundaries edit ->
                    DungeonMapTopologyOps.editClusterBoundaries(
                            current,
                            edit.clusterId(),
                            edit.edges(),
                            edit.kind(),
                            edit.deleteBoundary());
            case DungeonEditorOperationInstructionUseCase.CreateCorridor create ->
                    DungeonMapCorridorOps.createCorridor(current, create.start(), create.end());
            case DungeonEditorOperationInstructionUseCase.ExtendCorridor extend ->
                    DungeonMapCorridorOps.extendCorridor(current, extend.corridorId(), extend.endpoint());
            case DungeonEditorOperationInstructionUseCase.MergeCorridors merge ->
                    DungeonMapCorridorOps.mergeCorridors(current, merge.corridorId(), merge.mergedCorridorId());
            case DungeonEditorOperationInstructionUseCase.DeleteCorridor delete ->
                    DungeonMapCorridorOps.deleteCorridor(current, delete.corridorId());
            case DungeonEditorOperationInstructionUseCase.SaveRoomNarration save ->
                    DungeonMapTopologyOps.saveRoomNarration(current, save.roomId(), save.narration());
        };
    }
}
