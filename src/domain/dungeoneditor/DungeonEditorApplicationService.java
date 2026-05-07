package src.domain.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeoneditor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeoneditor.published.ApplyDungeonEditorSessionCommand;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;

public final class DungeonEditorApplicationService {

    private final ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase;
    private final List<Consumer<DungeonEditorSnapshot>> editorListeners = new ArrayList<>();
    private final DungeonEditorModel editorModel = new DungeonEditorModel(
            this::currentEditorSnapshot,
            this::subscribeEditorListener);

    public DungeonEditorApplicationService(DungeonApplicationService dungeonApplicationService) {
        DungeonApplicationService dungeon = Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService");
        this.applyDungeonEditorSessionUseCase = new ApplyDungeonEditorSessionUseCase(
                dungeon::catalog,
                dungeon::mutateAuthored,
                dungeon::loadAuthored);
    }

    public DungeonEditorModel loadEditor(LoadDungeonEditorQuery query) {
        DungeonMapId requestedMapId = DungeonEditorCommandBoundaryTranslator.requestedDomainMapId(query);
        if (requestedMapId != null) {
            applyDungeonEditorSessionUseCase.primeSelectedMap(requestedMapId);
        }
        return editorModel;
    }

    public DungeonEditorSnapshot applyEditorSession(ApplyDungeonEditorSessionCommand command) {
        applyDungeonEditorSessionUseCase.apply(DungeonEditorCommandBoundaryTranslator.toInternalCommand(command));
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
