package features.world.hexmap.ui.editor.panes;

import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.ui.shared.HexTerrainUiType;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;

/**
 * Zustandspanel fuer den Karteneditor mit toolspezifischen Einstellungen.
 * Aktuell wird die Gelaendepalette (Brush-Modus) angezeigt; spaeter z. B. Brush-Radius.
 */
public class ToolSettingsPane extends VBox {

    private final VBox terrainSection;
    private HexTerrainType activeTerrainType = HexTerrainType.GRASSLAND;
    private Consumer<HexTerrainType> onTerrainSelected;

    public ToolSettingsPane() {
        getStyleClass().add("tool-settings-pane");
        setSpacing(0);

        terrainSection = buildTerrainSection();
        terrainSection.setVisible(false);
        terrainSection.setManaged(false);

        getChildren().add(terrainSection);
    }

    private VBox buildTerrainSection() {
        VBox section = new VBox(4);
        section.setPadding(new Insets(12));

        Label header = new Label("Gelände");
        header.getStyleClass().add("bold");
        section.getChildren().add(header);

        ToggleGroup terrainGroup = new ToggleGroup();

        for (HexTerrainUiType terrain : HexTerrainUiType.values()) {
            Region swatch = new Region();
            swatch.getStyleClass().addAll("terrain-swatch", terrain.swatchCssClass());

            ToggleButton btn = new ToggleButton(terrain.label);
            btn.setGraphic(swatch);
            btn.setToggleGroup(terrainGroup);
            btn.getStyleClass().add("terrain-btn");
            btn.setMaxWidth(Double.MAX_VALUE);
            btn.setAlignment(Pos.CENTER_LEFT);
            btn.setAccessibleText(terrain.label);

            if (terrain.key.equals(activeTerrainType.dbValue())) {
                btn.setSelected(true);
            }

            btn.setOnAction(e -> {
                if (btn.isSelected()) {
                    activeTerrainType = HexTerrainType.fromKey(terrain.key).orElse(HexTerrainType.GRASSLAND);
                    if (onTerrainSelected != null) onTerrainSelected.accept(activeTerrainType);
                } else {
                    btn.setSelected(true); // Deselect verhindern: es muss immer ein Gelaende aktiv sein
                }
            });

            section.getChildren().add(btn);
        }

        return section;
    }

    /** Zeigt oder versteckt die Gelaendepalette (bei Toolwechsel aufrufen). */
    public void setTerrainVisible(boolean visible) {
        terrainSection.setVisible(visible);
        terrainSection.setManaged(visible);
    }

    public HexTerrainType getActiveTerrainType() { return activeTerrainType; }
    public void setOnTerrainSelected(Consumer<HexTerrainType> cb) { onTerrainSelected = cb; }
}
