package ui.overworld;

import javafx.scene.layout.StackPane;
import services.HexMapService;
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

    public void loadFirstMap() {
        HexMapService.loadFirstMapAsync(
                hexGrid::loadTiles,
                ex -> System.err.println("HexMapPane.loadFirstMap(): " + ex.getMessage()));
    }

    public void loadMap(long mapId) {
        HexMapService.loadMapAsync(mapId,
                hexGrid::loadTiles,
                ex -> System.err.println("HexMapPane.loadMap(): " + ex.getMessage()));
    }
}
