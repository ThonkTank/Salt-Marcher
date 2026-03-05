package ui.mapeditor;

import entities.HexTile;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.components.TerrainType;

import java.util.function.Consumer;

/**
 * Right-column panel for the map editor.
 * Top: terrain palette (visible in brush mode).
 * Bottom: properties of the selected tile.
 */
public class TilePropertiesPane extends VBox {

    private final VBox terrainSection;
    private final VBox tileSection;
    private final Label tileContent;

    private String activeTerrainType = TerrainType.GRASSLAND.key;
    private Consumer<String> onTerrainSelected;

    public TilePropertiesPane() {
        getStyleClass().add("tile-properties-pane");
        setPrefWidth(380);
        setMinWidth(280);
        setSpacing(0);

        // -- Terrain palette (brush mode only) --
        terrainSection = buildTerrainSection();
        terrainSection.setVisible(false);
        terrainSection.setManaged(false);

        // -- Separator --
        Region sep = new Region();
        sep.getStyleClass().add("nav-separator");
        sep.setMinHeight(1);
        sep.setPrefHeight(1);
        VBox.setMargin(sep, new Insets(0));

        // -- Tile properties --
        tileSection = new VBox(6);
        tileSection.setPadding(new Insets(12));

        Label tileHeader = new Label("Feld-Eigenschaften");
        tileHeader.getStyleClass().add("title");

        tileContent = new Label("Kein Feld ausgewählt");
        tileContent.getStyleClass().add("text-muted");
        tileContent.setWrapText(true);

        tileSection.getChildren().addAll(tileHeader, tileContent);
        VBox.setVgrow(tileSection, Priority.ALWAYS);

        getChildren().addAll(terrainSection, sep, tileSection);
    }

    private VBox buildTerrainSection() {
        VBox section = new VBox(4);
        section.setPadding(new Insets(12));

        Label header = new Label("Gelände");
        header.getStyleClass().add("bold");
        section.getChildren().add(header);

        ToggleGroup terrainGroup = new ToggleGroup();

        for (TerrainType terrain : TerrainType.values()) {
            Region swatch = new Region();
            swatch.getStyleClass().addAll("terrain-swatch", terrain.swatchCssClass());

            ToggleButton btn = new ToggleButton(terrain.label);
            btn.setGraphic(swatch);
            btn.setToggleGroup(terrainGroup);
            btn.getStyleClass().add("terrain-btn");
            btn.setMaxWidth(Double.MAX_VALUE);
            btn.setAlignment(Pos.CENTER_LEFT);
            btn.setAccessibleText(terrain.label);

            if (terrain.key.equals(activeTerrainType)) {
                btn.setSelected(true);
            }

            btn.setOnAction(e -> {
                if (btn.isSelected()) {
                    activeTerrainType = terrain.key;
                    if (onTerrainSelected != null) onTerrainSelected.accept(terrain.key);
                } else {
                    // Prevent deselection
                    btn.setSelected(true);
                }
            });

            section.getChildren().add(btn);
        }

        return section;
    }

    /** Shows or hides the terrain palette (call on tool change). */
    public void setTerrainVisible(boolean visible) {
        terrainSection.setVisible(visible);
        terrainSection.setManaged(visible);
    }

    /** Called when a tile is selected or painted in the editor canvas. */
    public void showTile(HexTile tile) {
        if (tile == null) {
            tileContent.setText("Kein Feld ausgewählt");
            tileContent.getStyleClass().add("text-muted");
        } else {
            tileContent.getStyleClass().remove("text-muted");
            tileContent.setText(
                "Q: " + tile.Q + "   R: " + tile.R
                + "\nGelände: " + (tile.TerrainType != null ? tile.TerrainType : "—")
            );
        }
    }

    public String getActiveTerrainType() { return activeTerrainType; }
    public void setOnTerrainSelected(Consumer<String> cb) { onTerrainSelected = cb; }
}
