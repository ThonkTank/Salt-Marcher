package features.world.hexmap.ui.editor.panes;

import features.world.hexmap.ui.editor.controls.EditorTool;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.ui.shared.HexTerrainUiType;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;

/**
 * Zustandspanel fuer den Karteneditor mit stabilem Werkzeug-Status und toolspezifischen Optionen.
 */
public class ToolSettingsPane extends VBox {

    private final Label activeToolLabel = new Label("Auswahl");
    private final VBox terrainSection;
    private EditorTool activeTool = EditorTool.SELECT;
    private HexTerrainType activeTerrainType = HexTerrainType.GRASSLAND;
    private Consumer<HexTerrainType> onTerrainSelected;

    public ToolSettingsPane() {
        getStyleClass().addAll("tool-settings-pane", "map-editor-tool-settings-pane");
        setSpacing(10);
        activeToolLabel.getStyleClass().add("editor-panel-title");

        VBox overviewCard = card("Werkzeug", activeToolLabel);
        terrainSection = buildTerrainSection();
        setGroupVisible(terrainSection, false);

        getChildren().addAll(overviewCard, terrainSection);
    }

    private VBox buildTerrainSection() {
        FlowPane terrainGrid = new FlowPane();
        terrainGrid.setHgap(6);
        terrainGrid.setVgap(6);
        terrainGrid.getStyleClass().add("map-editor-terrain-grid");

        ToggleGroup terrainGroup = new ToggleGroup();

        for (HexTerrainUiType terrain : HexTerrainUiType.values()) {
            Region swatch = new Region();
            swatch.getStyleClass().addAll("terrain-swatch", terrain.swatchCssClass());

            ToggleButton btn = new ToggleButton(terrain.label);
            btn.setGraphic(swatch);
            btn.setToggleGroup(terrainGroup);
            btn.getStyleClass().add("terrain-btn");
            btn.getStyleClass().add("terrain-chip");
            btn.setPrefWidth(104);
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

            terrainGrid.getChildren().add(btn);
        }

        return card("Gelände", terrainGrid);
    }

    public void setActiveTool(EditorTool tool) {
        activeTool = tool == null ? EditorTool.SELECT : tool;
        activeToolLabel.setText(toolTitle(activeTool));
        setGroupVisible(terrainSection, activeTool == EditorTool.TERRAIN_BRUSH);
    }

    private static VBox card(String title, javafx.scene.Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    private static void setGroupVisible(VBox group, boolean visible) {
        group.setVisible(visible);
        group.setManaged(visible);
    }

    private static String toolTitle(EditorTool tool) {
        return tool == EditorTool.TERRAIN_BRUSH ? "Gelände malen" : "Auswahl";
    }

    public HexTerrainType getActiveTerrainType() { return activeTerrainType; }
    public void setOnTerrainSelected(Consumer<HexTerrainType> cb) { onTerrainSelected = cb; }
}
