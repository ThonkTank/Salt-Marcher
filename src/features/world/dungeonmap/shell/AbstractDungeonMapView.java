package features.world.dungeonmap.shell;

import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.state.DungeonMapState;
import ui.shell.AppView;

public abstract class AbstractDungeonMapView implements AppView {

    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState state;
    private boolean initialized;

    protected AbstractDungeonMapView(
            boolean editorMode,
            DungeonMapLoadingService loadingService,
            DungeonMapState state
    ) {
        this.loadingService = loadingService;
        this.state = state;
        this.workspace = new DungeonCanvasWorkspace(editorMode, state.activeMap());
    }

    @Override
    public final DungeonCanvasWorkspace getMainContent() {
        ensureInitialized();
        return workspace;
    }

    @Override
    public final void onShow() {
        ensureInitialized();
        loadingService.ensureLoaded();
    }

    protected final DungeonCanvasWorkspace workspace() {
        return workspace;
    }

    protected final DungeonMapLoadingService loadingService() {
        return loadingService;
    }

    protected final DungeonMapState state() {
        return state;
    }

    protected void onStateRefreshed() {
    }

    protected void onWorkspaceStateChanged() {
    }

    private void ensureInitialized() {
        if (initialized) {
            return;
        }
        initialized = true;
        state.addListener(this::refreshFromState);
        workspace.setOnStateChanged(this::onWorkspaceStateChanged);
        refreshFromState();
    }

    private void refreshFromState() {
        workspace.setMapModel(state.activeMap());
        workspace.setProjectionLevel(state.activeProjectionLevel());
        onStateRefreshed();
    }
}
