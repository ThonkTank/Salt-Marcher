package ui.mapeditor;

import entities.HexMap;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Consumer;

/**
 * Horizontal tool panel for the map editor: map selector + tool toggles.
 * Sits above the map canvas as a compact single-row bar (~36px).
 * Terrain palette lives in TilePropertiesPane (right column).
 */
public class MapEditorControls extends HBox {

    private EditorTool activeTool = EditorTool.SELECT;

    private Consumer<EditorTool> onToolChanged;
    private Consumer<Long> onMapSelected;
    private Runnable onNewMapRequested;

    private final ComboBox<HexMap> mapCombo = new ComboBox<>();
    private boolean updatingMapCombo = false;

    public MapEditorControls() {
        getStyleClass().add("map-editor-toolbar");
        setAlignment(Pos.CENTER_LEFT);
        setSpacing(8);
        setPadding(new Insets(6, 12, 6, 12));

        // -- Map selector --
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

        // -- Separator --
        Region sep = new Region();
        sep.getStyleClass().add("toolbar-divider");
        HBox.setMargin(sep, new Insets(0, 4, 0, 4));

        // -- Tool toggles --
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

        // Prevent deselection (always one active)
        toolGroup.selectedToggleProperty().addListener((obs, oldT, newT) -> {
            if (newT == null) { oldT.setSelected(true); return; }
            activeTool = (newT == selectBtn) ? EditorTool.SELECT : EditorTool.TERRAIN_BRUSH;
            if (onToolChanged != null) onToolChanged.accept(activeTool);
        });

        getChildren().addAll(mapCombo, newMapBtn, sep, selectBtn, brushBtn);
    }

    /** Populates the map combo box. Does not fire onMapSelected. */
    public void setMaps(List<HexMap> maps) {
        updatingMapCombo = true;
        HexMap prev = mapCombo.getValue();
        mapCombo.getItems().setAll(maps);
        if (prev != null) {
            for (HexMap m : maps) {
                if (m.MapId.equals(prev.MapId)) { mapCombo.setValue(m); break; }
            }
        }
        updatingMapCombo = false;
    }

    /** Selects the map with the given ID in the combo box. Fires onMapSelected. */
    public void selectMap(long mapId) {
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
}
