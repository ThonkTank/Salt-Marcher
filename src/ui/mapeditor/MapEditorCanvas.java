package ui.mapeditor;

import entities.HexTile;
import javafx.scene.layout.StackPane;
import services.HexMapService;
import ui.components.HexGridPane;

import java.util.function.Consumer;

/** Center content area for the map editor: interactive hex grid in edit mode. */
public class MapEditorCanvas extends StackPane {

    private final HexGridPane hexGrid = new HexGridPane();

    public MapEditorCanvas() {
        getStyleClass().add("map-editor-canvas");
        setMinSize(200, 200);
        hexGrid.prefWidthProperty().bind(widthProperty());
        hexGrid.prefHeightProperty().bind(heightProperty());
        getChildren().add(hexGrid);
    }

    public void loadFirstMap() {
        HexMapService.loadFirstMapAsync(
                hexGrid::loadTiles,
                ex -> System.err.println("MapEditorCanvas.loadFirstMap(): " + ex.getMessage()));
    }

    public void loadMap(long mapId) {
        HexMapService.loadMapAsync(mapId,
                hexGrid::loadTiles,
                ex -> System.err.println("MapEditorCanvas.loadMap(): " + ex.getMessage()));
    }

    public void setOnTileClicked(Consumer<HexTile> cb)     { hexGrid.setOnTileClicked(cb); }
    public void setOnTileDragPainted(Consumer<HexTile> cb) { hexGrid.setOnTileDragPainted(cb); }
    public void setPaintMode(boolean paintMode)              { hexGrid.setPaintMode(paintMode); }
    public void setOnPaintStrokeFinished(Runnable cb)       { hexGrid.setOnPaintStrokeFinished(cb); }

    public void updateTileTerrain(long tileId, String terrainType) {
        hexGrid.updateTileTerrain(tileId, terrainType);
    }
}
