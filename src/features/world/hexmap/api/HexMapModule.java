package features.world.hexmap.api;

import features.world.hexmap.ui.editor.MapEditorView;
import features.world.hexmap.ui.overworld.OverworldView;
import features.world.hexmap.ui.travel.TravelPane;
import ui.shell.AppView;
import ui.shell.SceneRegistry;

import java.util.Objects;

public final class HexMapModule {

    private final AppView overworldView;
    private final AppView mapEditorView;

    public HexMapModule() {
        this.overworldView = new OverworldView();
        this.mapEditorView = new MapEditorView();
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
        sceneRegistry.registerScene("\uD83D\uDDFA Reise", new TravelPane());
    }

    public AppView overworldView() {
        return overworldView;
    }

    public AppView mapEditorView() {
        return mapEditorView;
    }
}
