package src.domain.dungeoneditor.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;

final class DungeonEditorSessionCommandUseCase {
    private final DungeonEditorSessionCatalogUseCase catalogWorkflow;
    private final DungeonEditorSessionInteractionUseCase interactionWorkflow;

    DungeonEditorSessionCommandUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.interactionWorkflow = new DungeonEditorSessionInteractionUseCase(mutateAuthored, snapshotBuilder);
        this.catalogWorkflow = new DungeonEditorSessionCatalogUseCase(catalog, interactionWorkflow);
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
