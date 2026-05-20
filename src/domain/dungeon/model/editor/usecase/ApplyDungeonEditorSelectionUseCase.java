package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorSelectionUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorSelectionUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonEditorMainViewInput input) {
        effectUseCase.applyCommittedGrid(committedSnapshot -> mainViewInterpreter.pressSelection(
                input,
                committedSnapshot,
                workflow.selection(),
                workflow.projectionLevel()));
    }

    public void drag(DungeonEditorMainViewInput input) {
        effectUseCase.applyCommittedGrid(ignored -> mainViewInterpreter.dragSelection(
                input,
                workflow.projectionLevel()));
    }

    public void release(DungeonEditorMainViewInput input) {
        effectUseCase.applyCommittedGrid(ignored -> mainViewInterpreter.releaseSelection(
                input,
                workflow.projectionLevel()));
    }

    public void hover(DungeonEditorMainViewInput input) {
        effectUseCase.applyEffect(mainViewInterpreter.hoverSelection());
    }

    public void scroll(int projectionLevelDelta) {
        effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.projectionLevel(),
                effectUseCase.loadCommittedSnapshot()));
    }

}
