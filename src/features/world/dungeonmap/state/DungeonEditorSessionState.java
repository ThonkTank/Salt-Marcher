package features.world.dungeonmap.state;

import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonEditorSessionState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private DungeonEditorTool selectedTool = DungeonEditorTool.SELECT;

    public DungeonViewMode viewMode() {
        return viewMode;
    }

    public DungeonEditorTool selectedTool() {
        return selectedTool;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public void selectViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return;
        }
        this.viewMode = nextViewMode;
        notifyListeners();
    }

    public void selectTool(DungeonEditorTool tool) {
        DungeonEditorTool nextTool = tool == null ? DungeonEditorTool.SELECT : tool;
        if (selectedTool == nextTool) {
            return;
        }
        selectedTool = nextTool;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
