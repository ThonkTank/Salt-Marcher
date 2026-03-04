package ui;

import javafx.scene.Node;

import java.util.List;

/**
 * Overworld travel view. Shows a hex map in the center with the party token.
 * Travel controls appear in the left control panel.
 *
 * The persistent ScenePane (lower right) is not modified on navigation —
 * it retains whatever content was last pushed there (e.g. encounter tracker).
 */
public class OverworldView implements AppView {

    private final OverworldControls overworldControls;
    private final HexMapPane hexMapPane;

    public OverworldView() {
        overworldControls = new OverworldControls();
        hexMapPane = new HexMapPane();
    }

    @Override public Node getRoot()         { return hexMapPane; }
    @Override public String getTitle()      { return "Overworld"; }
    @Override public String getIconText()   { return "\uD83D\uDDFA"; }
    @Override public Node getControlPanel() { return overworldControls; }
    @Override public List<Node> getToolbarItems() { return List.of(); }
}
