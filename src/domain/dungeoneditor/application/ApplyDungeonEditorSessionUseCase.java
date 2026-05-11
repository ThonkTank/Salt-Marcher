package src.domain.dungeoneditor.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class ApplyDungeonEditorSessionUseCase {
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final DungeonEditorSessionCommandUseCase commandWorkflow;
    private DungeonEditorSession session = DungeonEditorSession.empty();

    public ApplyDungeonEditorSessionUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadCommand, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(catalog, mutateAuthored, loadAuthored);
        this.commandWorkflow = new DungeonEditorSessionCommandUseCase(catalog, mutateAuthored, snapshotBuilder);
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (mapId != null) {
            session = session.primeSelectedMap(mapId.value());
        }
    }

    public void apply(@Nullable DungeonEditorSessionCommand command) {
        session = commandWorkflow.apply(session, command);
    }

    public DungeonEditorSessionSnapshot.SnapshotData snapshot() {
        DungeonEditorSessionSnapshot.SnapshotData snapshot = snapshotBuilder.execute(session);
        session = session.withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel());
        return snapshot;
    }

    static DungeonMapId requireMutationMapId(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapMutation mutation) {
            return mutation.mapId();
        }
        throw new IllegalStateException("Dungeon-Katalog-Antwort enthielt keine Mutation.");
    }

    static @Nullable DungeonOperationResult requireOperationResult(@Nullable DungeonAuthoredMutationResult result) {
        if (result instanceof DungeonAuthoredMutationResult.Operation operation) {
            return operation.result();
        }
        return null;
    }

    static DungeonMapId requireMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        DungeonMapId domainMapId = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
        if (domainMapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return domainMapId;
    }

    static String statusFromMessages(@Nullable DungeonOperationResult result) {
        if (result == null) {
            return "";
        }
        if (!result.reactionMessages().isEmpty()) {
            return result.reactionMessages().getFirst();
        }
        if (!result.validationMessages().isEmpty()) {
            return result.validationMessages().getFirst();
        }
        return "";
    }
}
