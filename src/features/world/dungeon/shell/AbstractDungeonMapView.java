package features.world.dungeon.shell;

import features.world.dungeon.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.input.EnsureLoadedInput;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import ui.shell.AppView;

/**
 * Shared dungeon shell view base around one view-local canvas workspace.
 *
 * <p>Views inherit the same load-on-show lifecycle and workspace ownership from here so editor and runtime screens do
 * not drift into separate shell contracts.</p>
 */
@SuppressWarnings("unused")
public abstract class AbstractDungeonMapView implements AppView {

    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapObject mapObject;
    private final DungeonMapState state;

    protected AbstractDungeonMapView(
            boolean editorMode,
            DungeonMapObject mapObject,
            DungeonMapState state
    ) {
        this.mapObject = mapObject;
        this.state = state;
        this.workspace = new DungeonCanvasWorkspace(editorMode, state);
    }

    @Override
    public final DungeonCanvasWorkspace getMainContent() {
        return workspace;
    }

    @Override
    public void onShow() {
        mapObject.ensureLoaded(new EnsureLoadedInput());
    }

    protected final DungeonCanvasWorkspace workspace() {
        return workspace;
    }

    protected final DungeonMapObject mapObject() {
        return mapObject;
    }

    protected final DungeonMapState state() {
        return state;
    }
}
