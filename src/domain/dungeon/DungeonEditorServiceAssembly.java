package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.editor.helper.DungeonEditorSnapshotProjectionHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonEditorModel;
import src.domain.dungeon.published.DungeonEditorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogModel;

final class DungeonEditorServiceAssembly {

    private final PublishedState publishedState = new PublishedState();

    DungeonEditorApplicationService create(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonEditorDungeonRepository dungeonRepository = new DungeonEditorDungeonRepository(
                services.require(DungeonCatalogApplicationService.class),
                services.require(DungeonAuthoredApplicationService.class));
        DungeonEditorDungeonPort dungeonPort = new DungeonEditorDungeonPort(
                services.require(DungeonMapCatalogModel.class),
                services.require(DungeonAuthoredReadModel.class),
                services.require(DungeonAuthoredMutationModel.class));
        ApplyDungeonEditorSessionUseCase useCase = new ApplyDungeonEditorSessionUseCase(
                dungeonRepository,
                dungeonPort,
                publishedState::publish);
        useCase.publishSnapshot();
        return new DungeonEditorApplicationService(useCase);
    }

    DungeonEditorModel createEditorModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, "registry");
        return publishedState.editorModel;
    }

    private static final class PublishedState {

        private final List<Consumer<DungeonEditorSnapshot>> listeners = new ArrayList<>();
        private final DungeonEditorModel editorModel = new DungeonEditorModel(
                this::current,
                this::subscribe);
        private DungeonEditorSnapshot current = DungeonEditorSnapshot.empty("");

        private void publish(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
            current = DungeonEditorSnapshotProjectionHelper.toPublishedSnapshot(snapshot);
            for (Consumer<DungeonEditorSnapshot> listener : List.copyOf(listeners)) {
                listener.accept(current);
            }
        }

        private DungeonEditorSnapshot current() {
            return current;
        }

        private Runnable subscribe(Consumer<DungeonEditorSnapshot> listener) {
            Consumer<DungeonEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
            listeners.add(safeListener);
            return () -> listeners.remove(safeListener);
        }
    }
}
