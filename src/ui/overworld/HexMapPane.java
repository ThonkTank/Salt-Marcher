package ui.overworld;

import entities.HexTile;
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

        hexGrid.setOnPartyTokenMoved(tile ->
                HexMapService.updatePartyTileAsync(tile.TileId));
    }

    public void loadFirstMap() {
        HexMapService.loadFirstMapWithPartyAsync(
                (tiles, partyTileId) -> {
                    hexGrid.loadTiles(tiles);
                    Long tokenTileId = partyTileId;
                    if (tokenTileId == null && !tiles.isEmpty()) {
                        tokenTileId = tiles.stream()
                                .filter(t -> t.Q == 0 && t.R == 0)
                                .findFirst()
                                .map(t -> t.TileId)
                                .orElse(tiles.get(0).TileId);
                        HexMapService.updatePartyTileAsync(tokenTileId);
                    }
                    hexGrid.setPartyToken(tokenTileId);
                },
                ex -> System.err.println("HexMapPane.loadFirstMap(): " + ex.getMessage()));
    }

    public void loadMap(long mapId) {
        HexMapService.loadMapAsync(mapId,
                hexGrid::loadTiles,
                ex -> System.err.println("HexMapPane.loadMap(): " + ex.getMessage()));
    }
}
