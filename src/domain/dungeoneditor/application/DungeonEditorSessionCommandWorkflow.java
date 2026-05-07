package src.domain.dungeoneditor.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;

final class DungeonEditorSessionCommandWorkflow {
    private final DungeonEditorSessionCatalogWorkflow catalogWorkflow;
    private final DungeonEditorSessionInteractionWorkflow interactionWorkflow;

    DungeonEditorSessionCommandWorkflow(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.interactionWorkflow = new DungeonEditorSessionInteractionWorkflow(mutateAuthored, snapshotBuilder);
        this.catalogWorkflow = new DungeonEditorSessionCatalogWorkflow(catalog, interactionWorkflow);
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
