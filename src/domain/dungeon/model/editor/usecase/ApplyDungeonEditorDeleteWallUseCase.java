package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorDeleteWallUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorDeleteWallUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonEditorMainViewInput input) {
        applyPress(input, DungeonEditorSessionValues.Tool.WALL_DELETE);
    }

    public void drag(DungeonEditorMainViewInput input) {
        applyDrag(input, DungeonEditorSessionValues.Tool.WALL_DELETE);
    }

    public void hover(DungeonEditorMainViewInput input) {
        applyHover(input, DungeonEditorSessionValues.Tool.WALL_DELETE);
    }

    private void applyPress(DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
        effectUseCase.applyCommittedGrid(committedSnapshot -> mainViewInterpreter.pressBoundary(
                input,
                committedSnapshot,
                workflow.selection(),
                tool,
                workflow.projectionLevel()));
    }

    private void applyDrag(DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
        effectUseCase.applyCommittedGrid(committedSnapshot -> mainViewInterpreter.dragBoundary(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }

    private void applyHover(DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
        effectUseCase.applyCommittedGrid(committedSnapshot -> mainViewInterpreter.hoverBoundary(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }
}
