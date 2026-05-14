package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeoneditor.model.session.repository.DungeonEditorDungeonRepository;

final class DungeonEditorSessionCommandUseCase {
    private final DungeonEditorSessionCatalogUseCase catalogWorkflow;
    private final DungeonEditorSessionInteractionUseCase interactionWorkflow;

    DungeonEditorSessionCommandUseCase(
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.interactionWorkflow = new DungeonEditorSessionInteractionUseCase(
                dungeonRepository,
                dungeonPort,
                snapshotBuilder);
        this.catalogWorkflow = new DungeonEditorSessionCatalogUseCase(
                dungeonRepository,
                dungeonPort,
                interactionWorkflow);
    }

    DungeonEditorSession apply(DungeonEditorSession session, @Nullable DungeonEditorSessionCommand command) {
        if (command == null) {
            return session;
        }
        return command.action().isCatalogAction()
                ? catalogWorkflow.apply(session, command)
                : interactionWorkflow.apply(session, command);
    }
}
