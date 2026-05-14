package src.domain.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeoneditor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeoneditor.model.session.helper.DungeonEditorCommandBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorSnapshotProjectionHelper;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;

public final class DungeonEditorApplicationService {

    private final ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase;
    private final List<Consumer<DungeonEditorSnapshot>> editorListeners = new ArrayList<>();
    private final DungeonEditorModel editorModel = new DungeonEditorModel(
            this::currentEditorSnapshot,
            this::subscribeEditorListener);

    public DungeonEditorApplicationService(ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase) {
        this.applyDungeonEditorSessionUseCase =
                Objects.requireNonNull(applyDungeonEditorSessionUseCase, "applyDungeonEditorSessionUseCase");
    }

    public DungeonEditorModel loadEditor(LoadDungeonEditorQuery query) {
        DungeonMapId requestedMapId = DungeonEditorCommandBoundaryTranslationHelper.requestedDomainMapId(query);
        if (requestedMapId != null) {
            applyDungeonEditorSessionUseCase.primeSelectedMap(requestedMapId);
        }
        return editorModel;
    }

    public void applyEditorSession(DungeonEditorSessionCommand command) {
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
    }

    private DungeonEditorSnapshot currentEditorSnapshot() {
        return DungeonEditorSnapshotProjectionHelper.toPublishedSnapshot(applyDungeonEditorSessionUseCase.snapshot());
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
