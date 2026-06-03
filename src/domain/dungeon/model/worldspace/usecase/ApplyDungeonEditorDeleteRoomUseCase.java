package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.worldspace.usecase.InterpretDungeonEditorMainViewInputUseCase.PointerAction;

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
        effectUseCase.applyEffect(mainViewInterpreter.room(
                PointerAction.PRESS,
                input,
                DungeonEditorSessionValues.Tool.ROOM_DELETE,
                workflow.session().projectionLevel()));
    }

    public void drag(MainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.room(
                PointerAction.DRAG,
                input,
                DungeonEditorSessionValues.Tool.ROOM_DELETE,
                workflow.session().projectionLevel()));
    }

    public void release(MainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.room(
                PointerAction.RELEASE,
                input,
                DungeonEditorSessionValues.Tool.ROOM_DELETE,
                workflow.session().projectionLevel()));
    }
}
