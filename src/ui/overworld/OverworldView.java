package ui.overworld;

import javafx.scene.Node;
import ui.AppView;
import ui.SceneHandle;
import ui.SceneRegistry;

/**
 * Overworld travel view. Shows a hex map in the center with the party token.
 * Travel controls appear in the left control panel.
 * Registers the "Reise" tab in ScenePane at construction time.
 */
public class OverworldView implements AppView {

    private final OverworldControls overworldControls;
    private final HexMapPane hexMapPane;
    @SuppressWarnings("unused") // reserved for future content swaps (e.g. travel vs. city mode)
    private final SceneHandle travelScene;
    private boolean mapLoaded = false;

    public OverworldView(SceneRegistry sceneRegistry) {
        overworldControls = new OverworldControls();
        hexMapPane = new HexMapPane();
        travelScene = sceneRegistry.registerScene("\uD83D\uDDFA Reise", new TravelPane());
    }

    @Override public Node getRoot()         { return hexMapPane; }
    @Override public String getTitle()      { return "Karte"; }
    @Override public String getIconText()   { return "\uD83D\uDDFA"; }
    @Override public Node getControlPanel() { return overworldControls; }

    @Override
    public void onShow() {
        if (!mapLoaded) {
            hexMapPane.loadFirstMap();
            mapLoaded = true;
        }
    }
}
