package src.domain.dungeon.model.editor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSession;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.model.session.repository.DungeonEditorDungeonRepository;

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
