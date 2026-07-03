package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSessionPreviewHelper;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;

final class DungeonEditorSelectedHandleRuntimeOperation {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;
    private final ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase;

    DungeonEditorSelectedHandleRuntimeOperation(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase,
            ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase,
            ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
        this.authoredOperationUseCase = Objects.requireNonNull(authoredOperationUseCase, "authoredOperationUseCase");
        this.handleOperationUseCase = Objects.requireNonNull(handleOperationUseCase, "handleOperationUseCase");
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        PointerAction effectiveAction = PointerAction.orMoved(action);
        if (effectiveAction.pressed()) {
            return press(input);
        } else if (effectiveAction.dragged()) {
            return drag(input);
        } else if (effectiveAction.released()) {
            return release(input);
        } else if (effectiveAction.moved()) {
            return hover(input);
        } else {
            throw new IllegalStateException("Unsupported selected-handle action: " + effectiveAction);
        }
    }

    DungeonEditorRuntimeOperationResult scroll(int projectionLevelDelta) {
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.session().projectionLevel(),
                effectUseCase.loadCommittedSnapshot()), null));
    }

    DungeonEditorRuntimeOperationResult moveCorridorPoint(
            DungeonEditorWorkspaceValues.HandleRef handle,
            int q,
            int r
    ) {
        DungeonEditorWorkspaceValues.HandleRef handleRef = handle == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : handle;
        if (!DungeonEditorSessionPreviewHelper.directCorridorMoveCommitHandle(handleRef.kind())
                || !workflow.session().hasSelectedMap()) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        DungeonEditorWorkspaceValues.Cell sourceCell = handleRef.cell();
        int deltaQ = q - sourceCell.q();
        int deltaR = r - sourceCell.r();
        if (deltaQ == 0 && deltaR == 0) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        DungeonEditorSessionValues.MoveHandlePreview preview = new DungeonEditorSessionValues.MoveHandlePreview(
                handleRef,
                deltaQ,
                deltaR,
                0);
        DungeonEditorWorkspaceValues.MapId selectedMapId = workflow.session().selectedMapId();
        if (selectedMapId == null) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        handleOperationUseCase.executeCorridorHandleMove(selectedMapId, preview);
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(effectUseCase.publishCurrent());
    }

    private DungeonEditorRuntimeOperationResult press(DungeonEditorMainViewInput input) {
        ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGrid =
                effectUseCase.committedGridOrPublishCurrentResult();
        MapSnapshot committedSnapshot = currentGrid.committedSnapshot();
        if (committedSnapshot == null) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(currentGrid.snapshot());
        }
        DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS,
                input,
                committedSnapshot,
                workflow.session().selection(),
                workflow.session().projectionLevel());
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(
                DungeonEditorDraftOperationSupport.latestSnapshot(currentGrid.snapshot(), effectUseCase.applyEffect(effect, null)));
    }

    private DungeonEditorRuntimeOperationResult drag(DungeonEditorMainViewInput input) {
        ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGrid =
                effectUseCase.committedGridOrPublishCurrentResult();
        if (currentGrid.committedSnapshot() == null) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(currentGrid.snapshot());
        }
        DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel());
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(
                DungeonEditorDraftOperationSupport.latestSnapshot(currentGrid.snapshot(), effectUseCase.applyEffect(effect, null)));
    }

    private DungeonEditorRuntimeOperationResult release(DungeonEditorMainViewInput input) {
        ApplyDungeonEditorSessionEffectUseCase.CurrentGridPublication currentGrid =
                effectUseCase.committedGridOrPublishCurrentResult();
        if (currentGrid.committedSnapshot() == null) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(currentGrid.snapshot());
        }
        DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel());
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(
                DungeonEditorDraftOperationSupport.latestSnapshot(
                        currentGrid.snapshot(),
                        effectUseCase.applyEffect(effect, commitFor(effect.getApplyPreview()))));
    }

    private DungeonEditorRuntimeOperationResult hover(DungeonEditorMainViewInput input) {
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(effectUseCase.applyEffect(mainViewInterpreter.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel()), null));
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit commitFor(
            DungeonEditorSessionValues.@Nullable Preview preview
    ) {
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview move) {
            return moveHandleCommitFor(move);
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return mapId -> authoredOperationUseCase.executeClusterBoundaryStretch(mapId, stretch);
        }
        return null;
    }

    private ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit moveHandleCommitFor(
            DungeonEditorSessionValues.MoveHandlePreview move
    ) {
        if (DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(move.handleRef().kind())) {
            return mapId -> authoredOperationUseCase.executeClusterHandleMove(mapId, move);
        }
        if (DungeonEditorSessionPreviewHelper.directDoorMoveCommitHandle(move.handleRef().kind())) {
            return mapId -> handleOperationUseCase.executeDoorHandleMove(mapId, move);
        }
        if (DungeonEditorSessionPreviewHelper.directCorridorMoveCommitHandle(move.handleRef().kind())) {
            return mapId -> handleOperationUseCase.executeCorridorHandleMove(mapId, move);
        }
        if (move.handleRef().kind() == DungeonEditorHandleType.STAIR_ANCHOR) {
            return mapId -> authoredOperationUseCase.executeStairHandleMove(mapId, move);
        }
        return null;
    }
}
