package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SetDungeonEditorToolUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public SetDungeonEditorToolUseCase(
            DungeonEditorSessionWorkflow workflow,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public void execute(String toolName) {
        workflow.setTool(toolName);
        snapshotPublicationUseCase.executeToolSelection(workflow.session());
    }
}
