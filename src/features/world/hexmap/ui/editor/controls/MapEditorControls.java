package features.world.hexmap.ui.editor.controls;

import features.world.hexmap.model.HexMap;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Consumer;

/**
 * Horizontale Werkzeugleiste fuer den Karteneditor: Kartenauswahl + Tool-Toggles.
 * Liegt oberhalb der Kartenflaeche als kompakte Ein-Zeilen-Leiste (~36px).
 * Die Gelaendepalette befindet sich in der ToolSettingsPane (rechte Spalte).
 */
public class MapEditorControls extends HBox {

    private EditorTool activeTool = EditorTool.SELECT;

    private Consumer<EditorTool> onToolChanged;
    private Consumer<Long> onMapSelected;
    private Runnable onNewMapRequested;
    private Consumer<HexMap> onEditMapRequested;

    private final ComboBox<HexMap> mapCombo = new ComboBox<>();
    private boolean updatingMapCombo = false;

    public MapEditorControls() {
        getStyleClass().add("map-editor-toolbar");
        setAlignment(Pos.CENTER_LEFT);
        setSpacing(8);
        setPadding(new Insets(6, 12, 6, 12));

        // -- Kartenauswahl --
        mapCombo.setPrefWidth(160);
        mapCombo.setMaxWidth(160);
        mapCombo.setPromptText("Karte wählen…");
        mapCombo.setConverter(new StringConverter<>() {
            @Override public String toString(HexMap m) { return m == null ? "" : m.Name; }
            @Override public HexMap fromString(String s) { return null; }
        });
        mapCombo.setOnAction(e -> {
            if (!updatingMapCombo && onMapSelected != null) {
                HexMap sel = mapCombo.getValue();
                if (sel != null) onMapSelected.accept(sel.MapId);
            }
        });

        Button newMapBtn = new Button("+");
        newMapBtn.getStyleClass().addAll("button", "compact");
        newMapBtn.setTooltip(new Tooltip("Neue Karte"));
        newMapBtn.setAccessibleText("Neue Karte");
        newMapBtn.setOnAction(e -> { if (onNewMapRequested != null) onNewMapRequested.run(); });

        Button editMapBtn = new Button("\u2699 Bearb.");
        editMapBtn.getStyleClass().addAll("button", "compact");
        editMapBtn.setTooltip(new Tooltip("Karte bearbeiten"));
        editMapBtn.setAccessibleText("Karte bearbeiten");
        editMapBtn.setOnAction(e -> {
            HexMap sel = mapCombo.getValue();
            if (sel != null && onEditMapRequested != null) onEditMapRequested.accept(sel);
        });
        editMapBtn.disableProperty().bind(mapCombo.valueProperty().isNull());

        // -- Trenner --
        Region sep = new Region();
        sep.getStyleClass().add("toolbar-divider");
        HBox.setMargin(sep, new Insets(0, 4, 0, 4));

        // -- Werkzeug-Toggles --
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

        // Deselect verhindern (es bleibt immer ein Tool aktiv)
        toolGroup.selectedToggleProperty().addListener((obs, oldT, newT) -> {
            if (newT == null) { oldT.setSelected(true); return; }
            activeTool = (newT == selectBtn) ? EditorTool.SELECT : EditorTool.TERRAIN_BRUSH;
            if (onToolChanged != null) onToolChanged.accept(activeTool);
        });

        getChildren().addAll(mapCombo, newMapBtn, editMapBtn, sep, selectBtn, brushBtn);
    }

    /** Fuellt die Karten-ComboBox ohne onMapSelected auszulösen. */
    public void setMaps(List<HexMap> maps) {
        updatingMapCombo = true;
        HexMap prev = mapCombo.getValue();
        mapCombo.getItems().setAll(maps);
        boolean restoredPreviousSelection = false;
        if (prev != null) {
            for (HexMap m : maps) {
                if (m.MapId != null && prev.MapId != null && m.MapId.equals(prev.MapId)) {
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
            if (m.MapId != null && m.MapId.equals(mapId)) {
                mapCombo.setValue(m);
                return;
            }
        }
    }

    public EditorTool getActiveTool() { return activeTool; }

    public void setOnToolChanged(Consumer<EditorTool> cb)   { onToolChanged = cb; }
    public void setOnMapSelected(Consumer<Long> cb)         { onMapSelected = cb; }
    public void setOnNewMapRequested(Runnable cb)            { onNewMapRequested = cb; }
    public void setOnEditMapRequested(Consumer<HexMap> cb)  { onEditMapRequested = cb; }
}
