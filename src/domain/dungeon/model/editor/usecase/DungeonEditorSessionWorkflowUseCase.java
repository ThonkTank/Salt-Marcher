package src.domain.dungeon.model.editor.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSession;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;

public final class DungeonEditorSessionWorkflowUseCase {
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final DungeonEditorSessionCommandUseCase commandWorkflow;
    private DungeonEditorSession session = DungeonEditorSession.empty();

    public DungeonEditorSessionWorkflowUseCase(
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort
    ) {
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(dungeonRepository, dungeonPort);
        this.commandWorkflow = new DungeonEditorSessionCommandUseCase(dungeonRepository, dungeonPort, snapshotBuilder);
    }

    public DungeonEditorSessionSnapshot.SnapshotData apply(@Nullable DungeonEditorSessionCommand command) {
        session = commandWorkflow.apply(session, command);
        return snapshot();
    }

    private DungeonEditorSessionSnapshot.SnapshotData snapshot() {
        DungeonEditorSessionSnapshot.SnapshotData snapshot = snapshotBuilder.execute(session);
        session = session.withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel());
        return snapshot;
    }
}
