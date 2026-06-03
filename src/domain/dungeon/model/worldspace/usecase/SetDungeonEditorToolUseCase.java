package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionWorkflow;

public final class SetDungeonEditorToolUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    public SetDungeonEditorToolUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
    }

    public void execute(String toolName) {
        mainViewInterpreter.clear();
        workflow.setTool(toolName);
        snapshotPublicationUseCase.executeToolSelection(workflow.session());
    }
}
