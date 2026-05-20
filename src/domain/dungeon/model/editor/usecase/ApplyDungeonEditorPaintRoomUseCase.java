package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorPaintRoomUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorPaintRoomUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonEditorMainViewInput input) {
        effectUseCase.applyCommittedGrid(ignored -> mainViewInterpreter.pressRoom(
                input,
                DungeonEditorSessionValues.Tool.ROOM_PAINT,
                workflow.projectionLevel()));
    }

    public void drag(DungeonEditorMainViewInput input) {
        effectUseCase.applyCommittedGrid(ignored -> mainViewInterpreter.dragRoom(
                input,
                workflow.projectionLevel()));
    }

    public void release(DungeonEditorMainViewInput input) {
        effectUseCase.applyCommittedGrid(ignored -> mainViewInterpreter.releaseRoom(
                input,
                workflow.projectionLevel()));
    }
}
