package features.world.hexmap.ui.overworld;

import features.world.hexmap.model.HexTile;
import features.world.hexmap.ui.shared.HexGridPane;
import javafx.scene.layout.StackPane;

import java.util.List;
import java.util.function.Consumer;

/** Hex-Grid-Kartenansicht fuer die Overworld-Reiseansicht. Nur Anzeige (keine Feldbearbeitung). */
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

    public void loadTilesWithPartyToken(List<HexTile> tiles, Long partyTileId) {
        hexGrid.loadTiles(tiles);
        hexGrid.setPartyToken(partyTileId);
    }

    public void loadTiles(List<HexTile> tiles) {
        hexGrid.loadTiles(tiles);
    }

    public void setOnPartyTokenMoved(Consumer<Long> callback) {
        hexGrid.setOnPartyTokenMoved(tile -> {
            if (callback == null || tile == null || tile.tileId() == null) return;
            callback.accept(tile.tileId());
        });
    }
}
