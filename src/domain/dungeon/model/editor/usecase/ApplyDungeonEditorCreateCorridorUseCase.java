package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorCreateCorridorUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateCorridorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonEditorMainViewInput input) {
        applyPress(input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
    }

    public void hover(DungeonEditorMainViewInput input) {
        applyHover(input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
    }

    private void applyPress(DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
        effectUseCase.applyCommittedGrid(committedSnapshot -> mainViewInterpreter.pressCorridor(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }

    private void applyHover(DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
        effectUseCase.applyCommittedGrid(committedSnapshot -> mainViewInterpreter.hoverCorridor(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }
}
