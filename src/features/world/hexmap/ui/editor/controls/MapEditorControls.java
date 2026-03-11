package features.world.hexmap.ui.editor.controls;

import features.world.hexmap.model.HexMap;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Consumer;

/**
 * Kompakte Werkzeugleiste fuer den Karteneditor mit getrennten Gruppen fuer Kartenkontext und Werkzeugwahl.
 * Die Gelaendepalette befindet sich in der ToolSettingsPane (rechte Spalte).
 */
public class MapEditorControls extends VBox {

    public record MapActionRequest(HexMap map, Node anchor) {}

    private EditorTool activeTool = EditorTool.SELECT;

    private Consumer<EditorTool> onToolChanged;
    private Consumer<Long> onMapSelected;
    private Consumer<Node> onNewMapRequested;
    private Consumer<MapActionRequest> onEditMapRequested;

    private final ComboBox<HexMap> mapCombo = new ComboBox<>();
    private boolean updatingMapCombo = false;

    public MapEditorControls() {
        getStyleClass().add("map-editor-toolbar");
        setSpacing(10);
        setPadding(new Insets(10, 12, 10, 12));

        mapCombo.setPrefWidth(160);
        mapCombo.setMaxWidth(Double.MAX_VALUE);
        mapCombo.setPromptText("Karte wählen…");
        mapCombo.setConverter(new StringConverter<>() {
            @Override public String toString(HexMap m) { return m == null ? "" : m.name(); }
            @Override public HexMap fromString(String s) { return null; }
        });
        mapCombo.setOnAction(e -> {
            if (!updatingMapCombo && onMapSelected != null) {
                HexMap sel = mapCombo.getValue();
                if (sel != null) onMapSelected.accept(sel.mapId());
            }
        });

        Button newMapBtn = new Button("+");
        newMapBtn.getStyleClass().addAll("button", "compact");
        newMapBtn.setTooltip(new Tooltip("Neue Karte"));
        newMapBtn.setAccessibleText("Neue Karte");
        newMapBtn.setOnAction(e -> { if (onNewMapRequested != null) onNewMapRequested.accept(newMapBtn); });

        Button editMapBtn = new Button("\u2699 Bearb.");
        editMapBtn.getStyleClass().addAll("button", "compact");
        editMapBtn.setTooltip(new Tooltip("Karte bearbeiten"));
        editMapBtn.setAccessibleText("Karte bearbeiten");
        editMapBtn.setOnAction(e -> {
            HexMap sel = mapCombo.getValue();
            if (sel != null && onEditMapRequested != null) onEditMapRequested.accept(new MapActionRequest(sel, editMapBtn));
        });
        editMapBtn.disableProperty().bind(mapCombo.valueProperty().isNull());

        ToggleGroup toolGroup = new ToggleGroup();

        ToggleButton selectBtn = new ToggleButton("↖ Auswahl");
        selectBtn.getStyleClass().add("tool-btn");
        selectBtn.setToggleGroup(toolGroup);
        selectBtn.setSelected(true);
        selectBtn.setAccessibleText("Auswahl-Werkzeug");

        ToggleButton brushBtn = new ToggleButton("🖌 Malen");
        brushBtn.getStyleClass().add("tool-btn");
        brushBtn.setToggleGroup(toolGroup);
        brushBtn.setAccessibleText("Gelände malen");

        toolGroup.selectedToggleProperty().addListener((obs, oldT, newT) -> {
            if (newT == null) { oldT.setSelected(true); return; }
            activeTool = (newT == selectBtn) ? EditorTool.SELECT : EditorTool.TERRAIN_BRUSH;
            if (onToolChanged != null) onToolChanged.accept(activeTool);
        });

        Label mapLabel = sectionLabel("Karte");
        HBox mapRow = new HBox(8, mapCombo, newMapBtn, editMapBtn);
        mapRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(mapCombo, Priority.ALWAYS);

        VBox mapGroup = new VBox(6, mapLabel, mapRow);
        mapGroup.getStyleClass().add("editor-toolbar-group");

        Label toolsLabel = sectionLabel("Werkzeug");
        HBox toolRow = new HBox(6, selectBtn, brushBtn);
        toolRow.setAlignment(Pos.CENTER_LEFT);
        VBox toolsGroup = new VBox(6, toolsLabel, toolRow);
        toolsGroup.getStyleClass().add("editor-toolbar-group");

        Separator separator = new Separator();
        separator.getStyleClass().add("control-separator");

        getChildren().addAll(mapGroup, separator, toolsGroup);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    /** Fuellt die Karten-ComboBox ohne onMapSelected auszulösen. */
    public void setMaps(List<HexMap> maps) {
        updatingMapCombo = true;
        HexMap prev = mapCombo.getValue();
        mapCombo.getItems().setAll(maps);
        boolean restoredPreviousSelection = false;
        if (prev != null) {
            for (HexMap m : maps) {
                if (m.mapId() != null && prev.mapId() != null && m.mapId().equals(prev.mapId())) {
                    mapCombo.setValue(m);
                    restoredPreviousSelection = true;
                    break;
                }
            }
        }
        if (!restoredPreviousSelection) {
            mapCombo.setValue(null);
        }
        updatingMapCombo = false;
    }

    /** Waehlt die Karte mit der gegebenen ID in der ComboBox aus. Loest onMapSelected aus. */
    public void selectMap(Long mapId) {
        if (mapId == null) return;
        for (HexMap m : mapCombo.getItems()) {
            if (m.mapId() != null && m.mapId().equals(mapId)) {
                mapCombo.setValue(m);
                return;
            }
        }
    }

    public EditorTool getActiveTool() { return activeTool; }

    public void setOnToolChanged(Consumer<EditorTool> cb)   { onToolChanged = cb; }
    public void setOnMapSelected(Consumer<Long> cb)         { onMapSelected = cb; }
    public void setOnNewMapRequested(Consumer<Node> cb) { onNewMapRequested = cb; }
    public void setOnEditMapRequested(Consumer<MapActionRequest> cb) { onEditMapRequested = cb; }
}
