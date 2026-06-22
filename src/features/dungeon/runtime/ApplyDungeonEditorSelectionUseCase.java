package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorHandleOperationUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSessionPreviewHelper;
import src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction;

final class ApplyDungeonEditorSelectionUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final ApplyDungeonEditorAuthoredOperationUseCase authoredOperationUseCase;
    private final ApplyDungeonEditorHandleOperationUseCase handleOperationUseCase;

    ApplyDungeonEditorSelectionUseCase(
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

    void press(DungeonEditorMainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                PointerAction.PRESS,
                input,
                committedSnapshot,
                workflow.session().selection(),
                workflow.session().projectionLevel());
        effectUseCase.applyEffect(effect, null);
    }

    void drag(DungeonEditorMainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.selection(
                    PointerAction.DRAG,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel()), null);
        }
    }

    void release(DungeonEditorMainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            DungeonEditorSessionEffect effect = mainViewInterpreter.selection(
                    PointerAction.RELEASE,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel());
            effectUseCase.applyEffect(effect, commitFor(effect.getApplyPreview()));
        }
    }

    void hover(DungeonEditorMainViewInput input) {
        effectUseCase.applyEffect(mainViewInterpreter.selection(
                PointerAction.HOVER,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel()), null);
    }

    void scroll(int projectionLevelDelta) {
        effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.session().projectionLevel(),
                effectUseCase.loadCommittedSnapshot()), null);
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
