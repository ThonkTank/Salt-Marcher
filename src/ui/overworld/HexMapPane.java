package ui.overworld;

import javafx.scene.layout.StackPane;
import ui.components.HexGridPane;

/** Hex grid map viewer for the overworld travel view. Read-only (no tile editing). */
public class HexMapPane extends StackPane {

    private final HexGridPane hexGrid = new HexGridPane();

    public HexMapPane() {
        getStyleClass().add("hex-map-pane");
        setMinSize(200, 200);
        hexGrid.setReadOnly(true);
        hexGrid.prefWidthProperty().bind(widthProperty());
        hexGrid.prefHeightProperty().bind(heightProperty());
        getChildren().add(hexGrid);
    }

    public void loadFirstMap() { hexGrid.loadFirstMap(); }
    public void loadMap(long mapId) { hexGrid.loadMap(mapId); }
}
