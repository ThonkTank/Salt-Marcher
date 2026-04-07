package features.world.dungeon.shell;

import features.world.dungeon.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import ui.shell.AppView;

/**
 * Shared dungeon shell view base around one view-local canvas workspace.
 *
 * <p>Views inherit the same load-on-show lifecycle and workspace ownership from here so editor and runtime screens do
 * not drift into separate shell contracts.</p>
 */
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
    public void onShow() {
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
