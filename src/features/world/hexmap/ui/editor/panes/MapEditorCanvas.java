package features.world.hexmap.ui.editor.panes;

import features.world.hexmap.model.HexTile;
import features.world.hexmap.ui.shared.HexGridPane;
import javafx.scene.layout.StackPane;

import java.util.List;
import java.util.function.Consumer;

/** Zentrale Flaeche des Karteneditors: interaktives Hex-Grid im Bearbeitungsmodus. */
public class MapEditorCanvas extends StackPane {

    private final HexGridPane hexGrid = new HexGridPane();

    public MapEditorCanvas() {
        getStyleClass().add("map-editor-canvas");
        setMinSize(200, 200);
        hexGrid.prefWidthProperty().bind(widthProperty());
        hexGrid.prefHeightProperty().bind(heightProperty());
        getChildren().add(hexGrid);
    }

    public void loadTiles(List<HexTile> tiles) {
        hexGrid.loadTiles(tiles);
    }

    public void setOnTileClicked(Consumer<HexTile> cb)     { hexGrid.setOnTileClicked(cb); }
    public void setOnTileDragPainted(Consumer<HexTile> cb) { hexGrid.setOnTileDragPainted(cb); }
    public void setPaintMode(boolean paintMode)              { hexGrid.setPaintMode(paintMode); }
    public void setOnPaintStrokeFinished(Runnable cb)       { hexGrid.setOnPaintStrokeFinished(cb); }

    public void updateTileTerrain(Long tileId, String terrainType) {
        if (tileId == null) return;
        hexGrid.updateTileTerrain(tileId, terrainType);
    }
}
