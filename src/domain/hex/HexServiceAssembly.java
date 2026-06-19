package src.domain.hex;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.hex.model.map.HexEditorState;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.repository.HexEditorPublishedStateRepository;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.model.map.usecase.CreateHexMapUseCase;
import src.domain.hex.model.map.usecase.LoadHexEditorStateUseCase;
import src.domain.hex.model.map.usecase.LoadHexEditorUseCase;
import src.domain.hex.model.map.usecase.PaintHexTerrainUseCase;
import src.domain.hex.model.map.usecase.SaveHexMarkerUseCase;
import src.domain.hex.model.map.usecase.SelectHexMapUseCase;
import src.domain.hex.model.map.usecase.SelectHexTileUseCase;
import src.domain.hex.model.map.usecase.SetHexEditorToolUseCase;
import src.domain.hex.model.map.usecase.UpdateHexMapUseCase;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexEditorSnapshot;

final class HexServiceAssembly implements HexEditorPublishedStateRepository {

    private final HexMapRepository repository;
    private final HexEditorWorkspace workspace = new HexEditorWorkspace();
    private final List<Consumer<HexEditorSnapshot>> listeners = new ArrayList<>();
    private HexEditorSnapshot currentSnapshot = HexEditorSnapshot.empty("No Hex map loaded.");
    private HexEditorApplicationService editorApplicationService;
    private HexEditorModel editorModel;

    HexServiceAssembly(HexMapRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    HexEditorApplicationService editorApplicationService() {
        if (editorApplicationService == null) {
            LoadHexEditorStateUseCase loadState = new LoadHexEditorStateUseCase(
                    repository,
                    workspace,
                    this);
            editorApplicationService = new HexEditorApplicationService(
                    new CreateHexMapUseCase(repository, loadState),
                    new LoadHexEditorUseCase(loadState),
                    new SelectHexMapUseCase(repository, loadState),
                    new UpdateHexMapUseCase(repository, loadState),
                    new SelectHexTileUseCase(repository, loadState),
                    new PaintHexTerrainUseCase(repository, loadState),
                    new SaveHexMarkerUseCase(repository, loadState),
                    new SetHexEditorToolUseCase(loadState));
        }
        return editorApplicationService;
    }

    HexEditorModel editorModel() {
        if (editorModel == null) {
            editorModel = new HexEditorModel(this::current, this::subscribe);
        }
        return editorModel;
    }

    @Override
    public void publish(HexEditorState state) {
        currentSnapshot = HexEditorSnapshotProjectionServiceAssembly.project(Objects.requireNonNull(state, "state"));
        for (Consumer<HexEditorSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(currentSnapshot);
        }
    }

    private HexEditorSnapshot current() {
        return currentSnapshot;
    }

    private Runnable subscribe(Consumer<HexEditorSnapshot> listener) {
        Consumer<HexEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        safeListener.accept(currentSnapshot);
        return () -> listeners.remove(safeListener);
    }
}
