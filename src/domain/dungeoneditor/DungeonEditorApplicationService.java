package src.domain.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeoneditor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeoneditor.application.DungeonEditorCommandBoundaryTranslator;
import src.domain.dungeoneditor.application.DungeonEditorSnapshotProjector;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;

public final class DungeonEditorApplicationService {

    private final ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase;
    private final List<Consumer<DungeonEditorSnapshot>> editorListeners = new ArrayList<>();
    private final DungeonEditorModel editorModel = new DungeonEditorModel(
            this::currentEditorSnapshot,
            this::subscribeEditorListener);

    public DungeonEditorApplicationService(
            DungeonApplicationService dungeonApplicationService,
            DungeonMapCatalogModel dungeonMapCatalogModel,
            DungeonAuthoredMutationModel dungeonAuthoredMutationModel,
            DungeonAuthoredReadModel dungeonAuthoredReadModel
    ) {
        DungeonApplicationService dungeon = Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService");
        DungeonMapCatalogModel catalogModel = Objects.requireNonNull(dungeonMapCatalogModel, "dungeonMapCatalogModel");
        DungeonAuthoredMutationModel mutationModel =
                Objects.requireNonNull(dungeonAuthoredMutationModel, "dungeonAuthoredMutationModel");
        DungeonAuthoredReadModel readModel = Objects.requireNonNull(dungeonAuthoredReadModel, "dungeonAuthoredReadModel");
        this.applyDungeonEditorSessionUseCase = new ApplyDungeonEditorSessionUseCase(
                command -> {
                    dungeon.catalog(command);
                    return catalogModel.current();
                },
                command -> {
                    dungeon.mutateAuthored(command);
                    return mutationModel.current();
                },
                command -> {
                    dungeon.refreshAuthored(command);
                    return readModel.current();
                });
    }

    public DungeonEditorModel loadEditor(LoadDungeonEditorQuery query) {
        DungeonMapId requestedMapId = DungeonEditorCommandBoundaryTranslator.requestedDomainMapId(query);
        if (requestedMapId != null) {
            applyDungeonEditorSessionUseCase.primeSelectedMap(requestedMapId);
        }
        return editorModel;
    }

    public DungeonEditorSnapshot applyEditorSession(DungeonEditorSessionCommand command) {
        applyDungeonEditorSessionUseCase.apply(command == null ? new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                null,
                "",
                null,
                null,
                0,
                null,
                null,
                null) : command);
        DungeonEditorSnapshot snapshot = currentEditorSnapshot();
        notifyEditorListeners(snapshot);
        return snapshot;
    }

    private DungeonEditorSnapshot currentEditorSnapshot() {
        return DungeonEditorSnapshotProjector.toPublishedSnapshot(applyDungeonEditorSessionUseCase.snapshot());
    }

    private Runnable subscribeEditorListener(Consumer<DungeonEditorSnapshot> listener) {
        Consumer<DungeonEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        editorListeners.add(safeListener);
        return () -> editorListeners.remove(safeListener);
    }

    private void notifyEditorListeners(DungeonEditorSnapshot snapshot) {
        List<Consumer<DungeonEditorSnapshot>> listeners = List.copyOf(editorListeners);
        for (Consumer<DungeonEditorSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }
}
