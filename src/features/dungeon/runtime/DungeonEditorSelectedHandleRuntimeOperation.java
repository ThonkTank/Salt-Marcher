package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSessionPreviewHelper;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

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

    void apply(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        PointerAction effectiveAction = action == null ? PointerAction.MOVED : action;
        if (effectiveAction == PointerAction.PRESSED) {
            press(input);
        } else if (effectiveAction == PointerAction.DRAGGED) {
            drag(input);
        } else if (effectiveAction == PointerAction.RELEASED) {
            release(input);
        } else if (effectiveAction == PointerAction.MOVED) {
            hover(input);
        } else {
            throw new IllegalStateException("Unsupported selected-handle action: " + effectiveAction);
        }
    }

    void scroll(int projectionLevelDelta) {
        effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.session().projectionLevel(),
                effectUseCase.loadCommittedSnapshot()), null);
    }

    void moveCorridorPoint(HandleTarget handle, int q, int r) {
        DungeonEditorWorkspaceValues.HandleRef handleRef = DungeonEditorHandleInputTranslator.handleRef(handle);
        if (!DungeonEditorSessionPreviewHelper.directCorridorMoveCommitHandle(handleRef.kind())
                || !workflow.session().hasSelectedMap()) {
            return;
        }
        DungeonEditorWorkspaceValues.Cell sourceCell = handleRef.cell();
        int deltaQ = q - sourceCell.q();
        int deltaR = r - sourceCell.r();
        if (deltaQ == 0 && deltaR == 0) {
            return;
        }
        DungeonEditorSessionValues.MoveHandlePreview preview = new DungeonEditorSessionValues.MoveHandlePreview(
                handleRef,
                deltaQ,
                deltaR,
                0);
        DungeonEditorWorkspaceValues.MapId selectedMapId = workflow.session().selectedMapId();
        if (selectedMapId == null) {
            return;
        }
        handleOperationUseCase.executeCorridorHandleMove(selectedMapId, preview);
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    private void press(DungeonEditorMainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS,
                input,
                committedSnapshot,
                workflow.session().selection(),
                workflow.session().projectionLevel());
        effectUseCase.applyEffect(effect, null);
    }

    private void drag(DungeonEditorMainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.selection(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel()), null);
        }
    }

    private void release(DungeonEditorMainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                    InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel());
            effectUseCase.applyEffect(effect, commitFor(effect.getApplyPreview()));
        }
    }

    private void hover(DungeonEditorMainViewInput input) {
        effectUseCase.applyEffect(mainViewInterpreter.selection(
                InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel()), null);
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
        return null;
    }
}
