package features.world.hexmap.ui.editor.panes;

import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Detailpanel des Karteneditors: Eigenschaften des ausgewaehlten Feldes.
 */
public class TilePropertiesPane extends VBox {

    private final Label tileContent;

    public TilePropertiesPane() {
        getStyleClass().add("tile-properties-pane");
        setSpacing(6);
        setPadding(new Insets(12));

        Label tileHeader = new Label("Feld-Eigenschaften");
        tileHeader.getStyleClass().add("title");

        tileContent = new Label("Kein Feld ausgewählt");
        tileContent.getStyleClass().add("text-muted");
        tileContent.setWrapText(true);

        getChildren().addAll(tileHeader, tileContent);
    }

    /** Wird aufgerufen, wenn im Editor ein Feld ausgewaehlt oder bemalt wurde. */
    public void showTile(HexTile tile) {
        showTile(tile, null);
    }

    /** Zeigt Feldinfos; optional mit temporärer Terrain-Überschreibung für optimistische UI-Updates. */
    public void showTile(HexTile tile, HexTerrainType terrainOverride) {
        if (tile == null) {
            tileContent.setText("Kein Feld ausgewählt");
            if (!tileContent.getStyleClass().contains("text-muted")) {
                tileContent.getStyleClass().add("text-muted");
            }
        } else {
            tileContent.getStyleClass().remove("text-muted");
            HexTerrainType displayTerrain = terrainOverride != null ? terrainOverride : tile.terrainType();
            tileContent.setText(
                "Q: " + tile.q() + "   R: " + tile.r()
                + "\nGelände: " + (displayTerrain != null ? displayTerrain.dbValue() : "—")
            );
        }
    }
}
