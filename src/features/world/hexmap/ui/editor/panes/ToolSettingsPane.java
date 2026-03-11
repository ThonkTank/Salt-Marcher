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
    private final Label activeToolHintLabel = new Label("Wähle ein Hexfeld aus, um seine Details rechts oben zu prüfen.");
    private final VBox terrainSection;
    private EditorTool activeTool = EditorTool.SELECT;
    private HexTerrainType activeTerrainType = HexTerrainType.GRASSLAND;
    private Consumer<HexTerrainType> onTerrainSelected;

    public ToolSettingsPane() {
        getStyleClass().addAll("tool-settings-pane", "map-editor-tool-settings-pane");
        setSpacing(12);
        Label header = new Label("EINSTELLUNGEN");
        header.getStyleClass().addAll("section-header", "text-muted");

        VBox overviewCard = card("Aktives Werkzeug", activeToolHintLabel, activeToolLabel);
        terrainSection = buildTerrainSection();
        setGroupVisible(terrainSection, false);

        getChildren().addAll(header, overviewCard, terrainSection);
    }

    private VBox buildTerrainSection() {
        Label hint = helperLabel("Wähle das Gelände für den nächsten Malstrich. Farbe und Text bleiben gekoppelt, damit die Auswahl schnell lesbar ist.");
        FlowPane terrainGrid = new FlowPane();
        terrainGrid.setHgap(8);
        terrainGrid.setVgap(8);
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
            btn.setPrefWidth(112);
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

        return card("Gelände", hint, terrainGrid);
    }

    public void setActiveTool(EditorTool tool) {
        activeTool = tool == null ? EditorTool.SELECT : tool;
        activeToolLabel.setText(toolTitle(activeTool));
        activeToolHintLabel.setText(toolHint(activeTool));
        setGroupVisible(terrainSection, activeTool == EditorTool.TERRAIN_BRUSH);
    }

    private static VBox card(String title, Label hint, javafx.scene.Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(8);
        box.getStyleClass().add("editor-card");
        box.getChildren().addAll(titleLabel, hint);
        box.getChildren().addAll(content);
        return box;
    }

    private static Label helperLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-secondary");
        label.setWrapText(true);
        return label;
    }

    private static void setGroupVisible(VBox group, boolean visible) {
        group.setVisible(visible);
        group.setManaged(visible);
    }

    private static String toolTitle(EditorTool tool) {
        return tool == EditorTool.TERRAIN_BRUSH ? "Gelände malen" : "Auswahl";
    }

    private static String toolHint(EditorTool tool) {
        return tool == EditorTool.TERRAIN_BRUSH
                ? "Male Hexfelder direkt auf der Karte. Die Geländewahl unten bleibt aktiv, bis du sie wechselst."
                : "Wähle ein Hexfeld aus, um seine Details rechts oben zu prüfen.";
    }

    public HexTerrainType getActiveTerrainType() { return activeTerrainType; }
    public void setOnTerrainSelected(Consumer<HexTerrainType> cb) { onTerrainSelected = cb; }
}
