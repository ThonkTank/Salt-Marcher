package features.world.dungeonmap.api;

import features.world.dungeonmap.ui.editor.DungeonEditorView;
import features.world.dungeonmap.ui.runtime.DungeonView;
import ui.shell.AppView;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule() {
        this.dungeonView = new DungeonView();
        this.dungeonEditorView = new DungeonEditorView();
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
