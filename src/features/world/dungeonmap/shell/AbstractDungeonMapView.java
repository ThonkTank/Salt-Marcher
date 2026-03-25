package features.world.dungeonmap.shell;

import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.state.DungeonMapState;
import ui.shell.AppView;

public abstract class AbstractDungeonMapView implements AppView {

    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState state;

    protected AbstractDungeonMapView(
            boolean editorMode,
            DungeonMapLoadingService loadingService,
            DungeonMapState state
    ) {
        this.loadingService = loadingService;
        this.state = state;
        this.workspace = new DungeonCanvasWorkspace(editorMode, state);
    }

    @Override
    public final DungeonCanvasWorkspace getMainContent() {
        return workspace;
    }

    @Override
    public final void onShow() {
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
}
