package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class ApplyDungeonEditorDeleteRoomUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorDeleteRoomUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.pressRoom(
                input,
                DungeonEditorSessionValues.Tool.ROOM_DELETE,
                workflow.projectionLevel()));
    }

    public void drag(MainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.dragRoom(
                input,
                workflow.projectionLevel()));
    }

    public void release(MainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.releaseRoom(
                input,
                workflow.projectionLevel()));
    }
}
